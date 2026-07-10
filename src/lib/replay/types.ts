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
  /** bake format version — bump BAKE_VERSION in the route to force re-bakes */
  version: number;
  sessionKey: number;
  sessionName: string;
  circuitKey: number;
  sessionYear?: number;
  /** ISO session start; t=0 everywhere below */
  t0: string;
  /** seconds covered by the grids */
  duration: number;
  hz: number;
  drivers: ReplayDriver[];
  /** per driver: x/y int arrays, length duration*hz+1 */
  pos: Record<number, { x: number[]; y: number[]; lastT: number; missing?: [number, number][] }>;
  /** sparse race-order changes, ascending t */
  order: { t: number; num: number; pos: number }[];
  /** per driver gap to leader (s) on gapGrid; null = no data / lapped */
  gapHz: number;
  gaps: Record<number, (number | null)[]>;
  /** gap to the car ahead on the same grid */
  intervals?: Record<number, (number | null)[]>;
  /** lapped gap labels preserved from OpenF1 instead of discarded */
  lapGaps?: Record<number, { t: number; label: string }[]>;
  /** tyre stints per driver, chronological */
  stints: Record<number, { compound: string | null; lapStart: number; lapEnd: number; tyreAge: number | null }[]>;
  /** every lap per driver, chronological */
  laps: Record<number, ReplayLap[]>;
  /** race-control messages (flags, SC/VSC, investigations), ascending t */
  raceControl: RaceControlEvent[];
  /** pit-lane visits per driver: lap, entry time, pit-lane duration */
  pits: Record<number, { lap: number; t: number; durationS: number | null; stopDurationS?: number | null }[]>;
  /** weather samples (~1/min), ascending t */
  weather: WeatherSample[];
  /** team-radio clips per driver (URLs only; playback UI comes later) */
  radio: Record<number, { t: number; url: string }[]>;
  /** official/native channels; optional for older OpenF1 sessions */
  overtakes?: { t: number; overtaking: number; overtaken: number; position: number | null }[];
  startingGrid?: { num: number; pos: number; lapDuration: number | null }[];
  result?: { num: number; pos: number | null; status: string | null; points: number | null }[];
}

export interface ReplayTelemetry {
  sessionKey: number;
  driverNumber: number;
  hz: number;
  t: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  rpm: number[];
  gear: number[];
  drs: number[];
}

export interface RaceControlEvent {
  t: number;
  /** Flag | SafetyCar | Drs | CarEvent | Other */
  category: string;
  /** GREEN | YELLOW | DOUBLE YELLOW | RED | CHEQUERED | CLEAR | BLUE | BLACK AND WHITE … */
  flag: string | null;
  /** Track | Sector | Driver */
  scope: string | null;
  sector: number | null;
  msg: string;
  driver: number | null;
  lap: number | null;
}

export interface WeatherSample {
  t: number;
  airTemp: number;
  trackTemp: number;
  humidity: number;
  windSpeed: number;
  windDir: number;
  rainfall: number;
}

export interface ReplayLap {
  lap: number;
  /** session-seconds at lap start; null when OpenF1 has no date_start */
  tStart: number | null;
  /** lap time seconds; null = in/out/aborted lap */
  time: number | null;
  sectors: [number | null, number | null, number | null];
  /** raw minisector codes per sector (2048 yellow / 2049 green / 2051 purple / 2064 pit) */
  segments: [number[], number[], number[]];
  /** speed-trap km/h */
  trap: number | null;
  pitOut: boolean;
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
  if (gaps.length === 0) return null;
  const f = Math.max(0, Math.min(t * gapHz, gaps.length - 1));
  const i = Math.floor(f);
  const j = Math.min(i + 1, gaps.length - 1);
  const a = gaps[i];
  const b = gaps[j];
  if (a == null) return b ?? null;
  if (b == null) return a;
  return a + (b - a) * (f - i);
}

export function lapGapAt(events: { t: number; label: string }[] | undefined, t: number): string | null {
  if (!events?.length) return null;
  let value: string | null = null;
  for (const event of events) {
    if (event.t > t) break;
    value = event.label;
  }
  return value;
}

export function positionIsStale(
  ch: { lastT: number; missing?: [number, number][] },
  t: number,
): boolean {
  if (t > ch.lastT + 6) return true;
  return (ch.missing ?? []).some(([start, end]) => t > start && t < end);
}
