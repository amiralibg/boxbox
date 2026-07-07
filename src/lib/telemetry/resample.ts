/**
 * Resampling raw OpenF1 samples (~3.7 Hz, irregular timestamps) onto a
 * uniform grid so playback interpolation is trivial. Positions get
 * Catmull-Rom (smooth through corners); scalar channels get linear; discrete
 * channels (gear, drs) get previous-sample hold.
 */

export interface TimedSample {
  /** seconds relative to lap start */
  t: number;
  v: number;
}

/** index of last sample with t <= target (binary search) */
function lowerBound(ts: number[], target: number): number {
  let lo = 0;
  let hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function resampleLinear(samples: TimedSample[], grid: number[]): number[] {
  const ts = samples.map((s) => s.t);
  return grid.map((g) => {
    if (g <= ts[0]) return samples[0].v;
    if (g >= ts[ts.length - 1]) return samples[samples.length - 1].v;
    const i = lowerBound(ts, g);
    const a = samples[i];
    const b = samples[i + 1];
    const u = (g - a.t) / (b.t - a.t || 1);
    return a.v + (b.v - a.v) * u;
  });
}

export function resampleHold(samples: TimedSample[], grid: number[]): number[] {
  const ts = samples.map((s) => s.t);
  return grid.map((g) => {
    if (g <= ts[0]) return samples[0].v;
    const i = lowerBound(ts, g);
    return samples[i].v;
  });
}

/** Catmull-Rom over non-uniform knots (centripetal-ish, using time as knot). */
export function resampleCatmullRom(samples: TimedSample[], grid: number[]): number[] {
  const ts = samples.map((s) => s.t);
  const vs = samples.map((s) => s.v);
  const n = samples.length;
  return grid.map((g) => {
    if (g <= ts[0]) return vs[0];
    if (g >= ts[n - 1]) return vs[n - 1];
    const i = lowerBound(ts, g);
    const t0 = ts[Math.max(0, i - 1)];
    const t1 = ts[i];
    const t2 = ts[Math.min(n - 1, i + 1)];
    const t3 = ts[Math.min(n - 1, i + 2)];
    const v0 = vs[Math.max(0, i - 1)];
    const v1 = vs[i];
    const v2 = vs[Math.min(n - 1, i + 1)];
    const v3 = vs[Math.min(n - 1, i + 2)];
    const u = (g - t1) / (t2 - t1 || 1);
    // finite-difference tangents scaled to the local interval
    const m1 = ((v2 - v0) / (t2 - t0 || 1)) * (t2 - t1);
    const m2 = ((v3 - v1) / (t3 - t1 || 1)) * (t2 - t1);
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
  });
}

export function makeGrid(duration: number, hz: number): number[] {
  const n = Math.ceil(duration * hz) + 1;
  return Array.from({ length: n }, (_, i) => Math.min(i / hz, duration));
}
