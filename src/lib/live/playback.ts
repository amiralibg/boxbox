import type { LiveFrame } from "@/lib/live/types";

interface Sample {
  t: number;
  x: number;
  y: number;
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

  /** interpolated position at session time t; null before the first sample */
  posAt(num: number, t: number): { x: number; y: number } | null {
    const arr = this.samples.get(num);
    if (!arr || arr.length === 0) return null;
    if (t <= arr[0].t) return arr[0];
    if (t >= arr[arr.length - 1].t) return arr[arr.length - 1];
    // binary search for the bracket
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
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
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
