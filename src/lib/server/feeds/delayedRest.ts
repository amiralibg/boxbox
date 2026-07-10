import type { DriverInfo, SessionInfo } from "@/lib/telemetry/types";
import type { LiveFeed, LiveFrame, LiveMeta } from "@/lib/live/types";

const POLL_MS = 4000;
/** starting real-time delay behind the wall clock — the free API publishes
 * data late and unevenly; chasing "now" starves the buffer and freezes the
 * field. The delay adapts per poll from the measured publication lag. */
const INITIAL_DELAY_S = 45;
const MIN_DELAY_S = 15;
const MAX_DELAY_S = 90;
/** margin added over the measured lag so ordinary jitter never drains us */
const DELAY_MARGIN_S = 8;
/** location samples are bucketed to this grid only to merge simultaneous rows */
const BUCKET_S = 0.01;

/**
 * Next real-time delay from the newest measured publication lag (how far the
 * newest returned sample trails the wall clock). EMA so one outlier poll
 * doesn't yank the clock around; clamped to a sane window. Pure — unit
 *-testable outside a race weekend.
 */
export function computeDelay(prevDelayS: number, observedLagS: number): number {
  const target = Math.min(MAX_DELAY_S, Math.max(MIN_DELAY_S, observedLagS + DELAY_MARGIN_S));
  return prevDelayS * 0.8 + target * 0.2;
}

interface LocationRow {
  date: string;
  driver_number: number;
  x: number;
  y: number;
}

interface PositionRow {
  date: string;
  driver_number: number;
  position: number;
}

interface IntervalRow {
  date: string;
  driver_number: number;
  gap_to_leader: number | string | null;
}

/**
 * DelayedRestFeed — the free-tier LiveFeed. Polls OpenF1 REST for everything
 * newer than the last returned sample and emits one frame per source sample
 * timestamp — clients buffer and interpolate through the true sample times,
 * so motion carries OpenF1's native cadence instead of a resampled step grid.
 *
 * During a genuinely live session the free API trails realtime by a little —
 * that's the "delayed" in the name. With `simulate`, the clock is remapped so
 * a historical session plays back as if it were live (speed× real time):
 * exercises the identical code path end to end.
 *
 * Live-window fetches are NOT routed through the disk cache — data grows as
 * the session runs, so responses must stay fresh.
 */
export class DelayedRestFeed implements LiveFeed {
  private subs = new Set<(f: LiveFrame) => void>();
  private endSubs = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private metaPromise: Promise<LiveMeta> | null = null;
  private t0 = 0;
  private tEnd = 0;
  private lastT = 0;
  private startedAt = 0;
  private polling = false;
  private seeded = false;
  private delayS = INITIAL_DELAY_S;
  private failures = 0;
  private skipPolls = 0;

  constructor(
    private sessionKey: number,
    private simulate = false,
    private speed = 1,
  ) {}

  private async fetchJson<T>(endpoint: string, params: string): Promise<T> {
    const res = await fetch(`https://api.openf1.org/v1/${endpoint}?${params}`);
    if (!res.ok) throw new Error(`OpenF1 ${endpoint}: ${res.status}`);
    return (await res.json()) as T;
  }

  meta(): Promise<LiveMeta> {
    this.metaPromise ??= (async () => {
      const [session] = await this.fetchJson<SessionInfo[]>("sessions", `session_key=${this.sessionKey}`);
      if (!session) throw new Error(`unknown session ${this.sessionKey}`);
      const drivers = await this.fetchJson<DriverInfo[]>("drivers", `session_key=${this.sessionKey}`);
      this.t0 = Date.parse(session.date_start);
      this.tEnd = (Date.parse(session.date_end) - this.t0) / 1000;
      return {
        sessionKey: this.sessionKey,
        sessionName: session.session_name,
        circuitKey: session.circuit_key,
        dateStart: session.date_start,
        dateEnd: session.date_end,
        drivers: drivers.map((d) => ({
          num: d.driver_number,
          acronym: d.name_acronym,
          team: d.team_name,
          colour: d.team_colour,
        })),
      };
    })();
    return this.metaPromise;
  }

  /** session-relative seconds of "now" (remapped when simulating) */
  private virtualNow(): number {
    if (this.simulate) return ((Date.now() - this.startedAt) / 1000) * this.speed;
    return (Date.now() - this.t0) / 1000 - this.delayS;
  }

  private iso(t: number): string {
    return new Date(this.t0 + t * 1000).toISOString();
  }

  private async poll() {
    if (this.polling) return; // never overlap slow polls
    if (this.skipPolls > 0) {
      this.skipPolls--;
      return;
    }
    this.polling = true;
    try {
      const now = Math.min(this.virtualNow(), this.tEnd);
      const from = this.lastT;
      if (now <= from) return;

      const windowQ = `session_key=${this.sessionKey}&date>${this.iso(from)}&date<${this.iso(now)}`;
      // first poll: take ALL position history up to now — the starting grid is
      // published before date_start and would never fall inside a window
      const positionQ = this.seeded ? windowQ : `session_key=${this.sessionKey}&date<${this.iso(now)}`;
      const [locations, positions, intervals] = await Promise.all([
        this.fetchJson<LocationRow[]>("location", windowQ),
        this.fetchJson<PositionRow[]>("position", positionQ),
        this.fetchJson<IntervalRow[]>("intervals", windowQ).catch(() => [] as IntervalRow[]),
      ]);
      this.seeded = true;

      // one frame per source sample bucket, keyed by true timestamp — clients
      // interpolate between real sample times, no server-side resampling
      const byBucket = new Map<number, LiveFrame>();
      let newest = -Infinity;
      const frameAt = (t: number): LiveFrame => {
        const key = Math.round(t / BUCKET_S);
        let f = byBucket.get(key);
        if (!f) byBucket.set(key, (f = { t: key * BUCKET_S, cars: {} }));
        return f;
      };

      for (const row of locations) {
        if (row.x === 0 && row.y === 0) continue;
        const t = (Date.parse(row.date) - this.t0) / 1000;
        newest = Math.max(newest, t);
        frameAt(t).cars[row.driver_number] = { x: row.x, y: row.y };
      }
      for (const p of positions) {
        const f = frameAt((Date.parse(p.date) - this.t0) / 1000);
        (f.order ??= []).push({ num: p.driver_number, pos: p.position });
      }
      for (const i of intervals) {
        const f = frameAt((Date.parse(i.date) - this.t0) / 1000);
        (f.gaps ??= {})[i.driver_number] = typeof i.gap_to_leader === "number" ? i.gap_to_leader : null;
      }

      // advance the window to the newest LOCATION sample actually returned —
      // chasing the wall clock instead permanently drops whatever hadn't been
      // published yet. (Sparser position/interval rows may be re-fetched by the
      // overlapping window; the client applies them idempotently.)
      this.lastT = Number.isFinite(newest) ? Math.max(from, newest) : Math.max(from, now - 10);

      // adapt the real-time delay to how late the API actually publishes:
      // newest sample trailing the wall clock by 20s means a 5s delay would
      // return nothing poll after poll and the field would freeze
      if (!this.simulate && Number.isFinite(newest)) {
        const observedLag = (Date.now() - this.t0) / 1000 - newest;
        this.delayS = computeDelay(this.delayS, observedLag);
      }

      const frames = [...byBucket.values()].sort((a, b) => a.t - b.t);
      for (const frame of frames) for (const cb of this.subs) cb(frame);
      this.failures = 0;

      if (now >= this.tEnd) {
        for (const cb of this.endSubs) cb();
        this.stop();
      }
    } catch (e) {
      // transient API failure — back off exponentially instead of hammering
      this.failures++;
      this.skipPolls = Math.min(2 ** this.failures, 8) - 1;
      console.warn(`DelayedRestFeed poll failed (×${this.failures}, backing off ${this.skipPolls} cycles):`, e);
    } finally {
      this.polling = false;
    }
  }

  subscribe(onFrame: (f: LiveFrame) => void, onEnd: () => void): () => void {
    this.subs.add(onFrame);
    this.endSubs.add(onEnd);
    if (!this.timer) {
      void this.meta().then(() => {
        this.startedAt = Date.now();
        this.lastT = this.simulate ? 0 : Math.max(0, this.virtualNow() - 30);
        const interval = this.simulate ? Math.max(1000, POLL_MS / this.speed) : POLL_MS;
        this.timer = setInterval(() => void this.poll(), interval);
        void this.poll();
      });
    }
    return () => {
      this.subs.delete(onFrame);
      this.endSubs.delete(onEnd);
      if (this.subs.size === 0) this.stop();
    };
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get subscriberCount() {
    return this.subs.size;
  }
}
