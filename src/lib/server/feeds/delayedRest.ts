import type { DriverInfo, SessionInfo } from "@/lib/telemetry/types";
import type { LiveFeed, LiveFrame, LiveMeta } from "@/lib/live/types";

const POLL_MS = 4000;

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
 * newer than the last poll and emits one normalized frame per cycle.
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
    return (Date.now() - this.t0) / 1000;
  }

  private iso(t: number): string {
    return new Date(this.t0 + t * 1000).toISOString();
  }

  private async poll() {
    if (this.polling) return; // never overlap slow polls
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
      this.lastT = now;

      const cars: LiveFrame["cars"] = {};
      for (const row of locations) {
        if (row.x === 0 && row.y === 0) continue;
        cars[row.driver_number] = { x: row.x, y: row.y }; // rows are time-ordered; last write wins
      }

      const orderMap = new Map<number, number>();
      for (const p of positions) orderMap.set(p.driver_number, p.position);

      const gaps: LiveFrame["gaps"] = {};
      for (const i of intervals) {
        gaps[i.driver_number] = typeof i.gap_to_leader === "number" ? i.gap_to_leader : null;
      }

      const frame: LiveFrame = { t: now, cars };
      if (orderMap.size > 0) frame.order = [...orderMap].map(([num, pos]) => ({ num, pos }));
      if (intervals.length > 0) frame.gaps = gaps;
      for (const cb of this.subs) cb(frame);

      if (now >= this.tEnd) {
        for (const cb of this.endSubs) cb();
        this.stop();
      }
    } catch {
      // transient API failure — skip this cycle, next poll retries
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
