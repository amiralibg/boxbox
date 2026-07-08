/** One driver's fastest lap, baked server-side onto a uniform time grid. */
export interface BakedLap {
  sessionKey: number;
  driverNumber: number;
  lapNumber: number;
  /** lap time in seconds */
  lapDuration: number;
  /** samples per second of the uniform grid */
  hz: number;
  /** seconds since lap start; t[i] = i / hz */
  t: number[];
  /** raw live-timing coordinates (same space as baked circuits) */
  x: number[];
  y: number[];
  /** cumulative distance along the lap, metres, dist[0] = 0 */
  dist: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  gear: number[];
  /** true where DRS open */
  drs: boolean[];
  /** sector durations of this lap, seconds (null when timing missed one) */
  sectors: [number | null, number | null, number | null];
  /** raw minisector codes per sector (2048 yellow / 2049 green / 2051 purple / 2064 pit) */
  segments: [number[], number[], number[]];
  /** speed-trap reading km/h, if any */
  speedTrap: number | null;
  /** tyre fitted for this lap */
  compound: string | null;
  /** tyre age in laps at the start of the stint's best lap */
  tyreAge: number | null;
}

export interface SessionInfo {
  session_key: number;
  meeting_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
  circuit_key: number;
  circuit_short_name: string;
  country_name: string;
  year: number;
}

export interface DriverInfo {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string;
  team_colour: string | null;
}
