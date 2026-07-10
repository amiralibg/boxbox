import type { LiveFrame } from "@/lib/live/types";

interface Sample {
  t: number;
  x: number;
  y: number;
}

/** bracket spans longer than this (session s) are dropped-signal holes —
 * hold the last position instead of sliding across the infield */
const GAP_MASK_S = 6;

/** Catmull-Rom point evaluation over non-uniform knots — same tangent math
 * as resampleCatmullRom (telemetry/resample.ts), but for a single t against
 * the live ring buffer instead of a full grid. */
function catmullRom(t0: number, t1: number, t2: number, t3: number, v0: number, v1: number, v2: number, v3: number, u: number): number {
  const m1 = ((v2 - v0) / (t2 - t0 || 1)) * (t2 - t1);
  const m2 = ((v3 - v1) / (t3 - t1 || 1)) * (t2 - t1);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
}

interface TimedEvent {
  t: number;
  order?: { num: number; pos: number }[];
  gaps?: Record<number, number | null>;
}

/**
 * Client-side jitter buffer for LiveFrames. The feed delivers bursts of
 * uniform-grid frames once per poll; this class replays them on a smooth
 * clock that trails the newest frame by `lagS` of session time, so cars
 * glide through every sample instead of jumping once per poll.
 *
 * All reads happen from rAF — no React state anywhere in here.
 */
export class LivePlayback {
  private samples = new Map<number, Sample[]>();
  private gapSeries = new Map<number, { t: number; v: number }[]>();
  private events: TimedEvent[] = [];
  private latestT = 0;
  private anchorT = -1;
  private anchorWall = 0;

  constructor(
    /** playback rate: simulate speed, or 1 for a real live session */
    private speed: number,
    /** how far behind the newest data the clock stays (session seconds) */
    private lagS: number,
  ) {}

  addFrame(f: LiveFrame) {
    if (f.t > this.latestT) this.latestT = f.t;
    for (const [numStr, c] of Object.entries(f.cars)) {
      const num = Number(numStr);
      let arr = this.samples.get(num);
      if (!arr) this.samples.set(num, (arr = []));
      const last = arr[arr.length - 1];
      if (last && f.t <= last.t) continue; // duplicates from overlapping windows
      arr.push({ t: f.t, x: c.x, y: c.y });
      if (arr.length > 800) arr.splice(0, arr.length - 500);
    }
    if (f.gaps) {
      for (const [numStr, gap] of Object.entries(f.gaps)) {
        if (gap == null) continue;
        const num = Number(numStr);
        let arr = this.gapSeries.get(num);
        if (!arr) this.gapSeries.set(num, (arr = []));
        const last = arr[arr.length - 1];
        if (last && f.t <= last.t) continue;
        arr.push({ t: f.t, v: gap });
        if (arr.length > 400) arr.splice(0, arr.length - 250);
      }
    }
    if (f.order || f.gaps) this.events.push({ t: f.t, order: f.order, gaps: f.gaps });
  }

  /**
   * Smooth playback clock. Advances at `speed`× real time, modulated by how
   * much buffered data is ahead: a draining buffer slows playback (down to
   * 0.7×) instead of freezing against the newest frame, an over-full one
   * creeps faster (up to 1.1×) until the lag is restored. Teleporting is
   * reserved for a feed that died and came back.
   */
  now(): number {
    const wall = performance.now() / 1000;
    const target = Math.max(0, this.latestT - this.lagS);
    if (this.anchorT < 0) {
      this.anchorT = target;
      this.anchorWall = wall;
      return target;
    }
    const headroom = this.latestT - this.anchorT;
    const rate = this.speed * Math.min(1.1, Math.max(0.7, headroom / this.lagS));
    let t = this.anchorT + (wall - this.anchorWall) * rate;
    if (t > this.latestT) t = this.latestT; // absolute floor: never pass the data
    if (target - t > 3 * this.lagS) t = target; // feed died and recovered — jump
    this.anchorT = t;
    this.anchorWall = wall;
    return t;
  }

  /** session-seconds of buffered data ahead of the playback clock */
  get bufferS(): number {
    return this.anchorT < 0 ? 0 : Math.max(0, this.latestT - this.anchorT);
  }

  /**
   * Interpolated position at session time t; null before the first sample.
   * Catmull-Rom through the neighboring samples — ~3.7 Hz linear chords cut
   * corners visibly. `stale` marks a signal hole (pit garage, dropped fixes):
   * the position is held, so render faded rather than gliding.
   */
  posAt(num: number, t: number): { x: number; y: number; stale: boolean } | null {
    const arr = this.samples.get(num);
    if (!arr || arr.length === 0) return null;
    const n = arr.length;
    if (t <= arr[0].t) return { x: arr[0].x, y: arr[0].y, stale: false };
    if (t >= arr[n - 1].t) return { x: arr[n - 1].x, y: arr[n - 1].y, stale: t - arr[n - 1].t > GAP_MASK_S };
    // binary search for the bracket
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = arr[lo];
    const b = arr[hi];
    if (b.t - a.t > GAP_MASK_S) return { x: a.x, y: a.y, stale: true };
    const p0 = arr[Math.max(0, lo - 1)];
    const p3 = arr[Math.min(n - 1, hi + 1)];
    const u = (t - a.t) / (b.t - a.t || 1);
    return {
      x: catmullRom(p0.t, a.t, b.t, p3.t, p0.x, a.x, b.x, p3.x, u),
      y: catmullRom(p0.t, a.t, b.t, p3.t, p0.y, a.y, b.y, p3.y, u),
      stale: false,
    };
  }

  /** interpolated gap-to-leader at session time t — glides between the
   * sparse interval samples instead of stepping once per poll */
  gapAt(num: number, t: number): number | null {
    const arr = this.gapSeries.get(num);
    if (!arr || arr.length === 0) return null;
    if (t <= arr[0].t) return arr[0].v;
    if (t >= arr[arr.length - 1].t) return arr[arr.length - 1].v;
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = arr[lo];
    const b = arr[hi];
    const u = (t - a.t) / (b.t - a.t || 1);
    return a.v + (b.v - a.v) * u;
  }

  /** order/gap events whose time has passed; removed once returned */
  drainEvents(t: number): TimedEvent[] {
    if (this.events.length === 0 || this.events[0].t > t) return [];
    const idx = this.events.findIndex((e) => e.t > t);
    return this.events.splice(0, idx === -1 ? this.events.length : idx);
  }

  get hasData() {
    return this.latestT > 0;
  }
}
