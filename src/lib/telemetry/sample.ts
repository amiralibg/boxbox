import type { BakedLap } from "./types";

export interface LapFrame {
  x: number;
  y: number;
  dist: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: boolean;
  done: boolean;
}

/**
 * Sample a baked lap at time t (seconds since lap start). Grid is uniform at
 * lap.hz, so this is a constant-time lerp — cheap enough for 60fps.
 */
export function sampleLap(lap: BakedLap, t: number): LapFrame {
  const n = lap.t.length;
  const clamped = Math.max(0, Math.min(t, lap.lapDuration));
  const f = clamped * lap.hz;
  const i = Math.min(Math.floor(f), n - 1);
  const j = Math.min(i + 1, n - 1);
  const u = f - i;
  const lerp = (a: number[]) => a[i] + (a[j] - a[i]) * u;
  return {
    x: lerp(lap.x),
    y: lerp(lap.y),
    dist: lerp(lap.dist),
    speed: lerp(lap.speed),
    throttle: lerp(lap.throttle),
    brake: lerp(lap.brake),
    gear: lap.gear[i],
    drs: lap.drs[i],
    done: t >= lap.lapDuration,
  };
}

/** Time at which the lap reaches distance s (inverse of the dist profile). */
export function timeAtDistance(lap: BakedLap, s: number): number {
  const d = lap.dist;
  const n = d.length;
  if (s <= 0) return 0;
  if (s >= d[n - 1]) return lap.lapDuration;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (d[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  const u = (s - d[lo]) / (d[lo + 1] - d[lo] || 1);
  return lap.t[lo] + (lap.t[lo + 1] - lap.t[lo]) * u;
}
