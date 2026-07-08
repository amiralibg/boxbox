/**
 * Baked replay blob for a whole session. Positions live on a uniform 2 Hz
 * grid (client lerps to 60fps); race order is an event list; gaps sit on a
 * coarse 0.25 Hz grid matching OpenF1's intervals cadence.
 */
export interface ReplayDriver {
  num: number;
  acronym: string;
  team: string;
  colour: string | null;
}

export interface ReplayBlob {
  sessionKey: number;
  sessionName: string;
  circuitKey: number;
  /** ISO session start; t=0 everywhere below */
  t0: string;
  /** seconds covered by the grids */
  duration: number;
  hz: number;
  drivers: ReplayDriver[];
  /** per driver: x/y int arrays, length duration*hz+1 */
  pos: Record<number, { x: number[]; y: number[]; lastT: number }>;
  /** sparse race-order changes, ascending t */
  order: { t: number; num: number; pos: number }[];
  /** per driver gap to leader (s) on gapGrid; null = no data / lapped */
  gapHz: number;
  gaps: Record<number, (number | null)[]>;
}

/** lerp a 2 Hz position channel at time t */
export function sampleXY(ch: { x: number[]; y: number[] }, hz: number, t: number): [number, number] {
  const n = ch.x.length;
  const f = Math.max(0, t * hz);
  const i = Math.min(Math.floor(f), n - 1);
  const j = Math.min(i + 1, n - 1);
  const u = f - i;
  return [ch.x[i] + (ch.x[j] - ch.x[i]) * u, ch.y[i] + (ch.y[j] - ch.y[i]) * u];
}

/** race order at time t: map driver → position (1-based) */
export function orderAt(events: ReplayBlob["order"], t: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const e of events) {
    if (e.t > t) break;
    m.set(e.num, e.pos);
  }
  return m;
}

export function gapAt(gaps: (number | null)[], gapHz: number, t: number): number | null {
  const i = Math.min(Math.max(0, Math.round(t * gapHz)), gaps.length - 1);
  return gaps[i] ?? null;
}
