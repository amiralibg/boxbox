import { timeAtDistance } from "./sample";
import type { BakedLap } from "./types";

export interface DeltaProfile {
  /** distance grid, metres */
  s: number[];
  /** tA(s) - tB(s): positive = A behind (slower to reach s) */
  delta: number[];
}

/**
 * Classic ghost delta: for each point on track, how much later does A get
 * there than B. Points are matched by lap-progress *fraction*, not absolute
 * metres — each lap's noisy GPS distance total differs by a few metres, and
 * fraction-matching guarantees delta(finish) == exact lap-time difference.
 * The s axis reports lapA's distance scale.
 */
export function buildDeltaProfile(lapA: BakedLap, lapB: BakedLap, points = 400): DeltaProfile {
  const totalA = lapA.dist[lapA.dist.length - 1];
  const totalB = lapB.dist[lapB.dist.length - 1];
  const s: number[] = [];
  const raw: number[] = [];
  for (let i = 0; i <= points; i++) {
    const p = i / points;
    s.push(p * totalA);
    raw.push(timeAtDistance(lapA, p * totalA) - timeAtDistance(lapB, p * totalB));
  }
  // The dist profiles are built from ~3.7 Hz positions resampled to 20 Hz, so
  // inverting them adds sawtooth jitter (~±0.05s). Boxcar-smooth it away —
  // window ≈ 2.5% of the lap keeps genuine corner-by-corner swings.
  const half = Math.max(1, Math.round(points * 0.0125));
  const delta = raw.map((_, i) => {
    // symmetric window, shrinking at the edges so the endpoints stay exact
    const h = Math.min(half, i, raw.length - 1 - i);
    let sum = 0;
    for (let j = i - h; j <= i + h; j++) sum += raw[j];
    return sum / (2 * h + 1);
  });
  return { s, delta };
}

/** Delta at an arbitrary distance, lerped from the profile. */
export function deltaAt(profile: DeltaProfile, dist: number): number {
  const { s, delta } = profile;
  const n = s.length;
  if (dist <= s[0]) return delta[0];
  if (dist >= s[n - 1]) return delta[n - 1];
  const step = s[1] - s[0] || 1;
  const f = (dist - s[0]) / step;
  const i = Math.min(Math.floor(f), n - 2);
  const u = f - i;
  return delta[i] + (delta[i + 1] - delta[i]) * u;
}
