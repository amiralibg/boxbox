import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import { makeGrid, resampleCatmullRom, resampleLinear, type TimedSample } from "@/lib/telemetry/resample";
import type { ReplayBlob, ReplayDriver } from "@/lib/replay/types";
import type { DriverInfo, SessionInfo } from "@/lib/telemetry/types";

const POS_HZ = 4;
const GAP_HZ = 0.25;
/** bump to invalidate every cached blob — the version is part of the filename */
const BAKE_VERSION = 3;
const BAKE_DIR = path.join(process.cwd(), ".cache", "replay");

interface LocationRow {
  date: string;
  x: number;
  y: number;
}

interface PositionRow {
  date: string;
  driver_number: number;
  position: number;
}

interface StintRow {
  driver_number: number;
  compound: string | null;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number | null;
}

interface IntervalRow {
  date: string;
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
}

interface LapRow {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  segments_sector_1: number[] | null;
  segments_sector_2: number[] | null;
  segments_sector_3: number[] | null;
  st_speed: number | null;
  is_pit_out_lap: boolean;
}

interface RaceControlRow {
  date: string;
  category: string;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  message: string;
  driver_number: number | null;
  lap_number: number | null;
}

interface PitRow {
  date: string;
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  stop_duration?: number | null;
}

interface OvertakeRow {
  date: string;
  overtaking_driver_number: number;
  overtaken_driver_number: number;
  position: number | null;
}

interface StartingGridRow {
  driver_number: number;
  position: number;
  lap_duration: number | null;
}

interface SessionResultRow {
  driver_number: number;
  position: number | null;
  points: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}

interface WeatherRow {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  rainfall: number;
}

interface RadioRow {
  date: string;
  driver_number: number;
  recording_url: string;
}

/**
 * Bakes a full session into one replay blob: 20 location fetches (disk-cached
 * by the OpenF1 client, politely queued), plus order + interval events.
 * First bake of a race takes a minute; afterwards it's served from disk.
 */
async function bake(sessionKey: number): Promise<ReplayBlob> {
  const [session] = await openf1<SessionInfo[]>("sessions", { session_key: sessionKey });
  if (!session) throw new Error(`unknown session ${sessionKey}`);
  const t0 = Date.parse(session.date_start);
  const duration = Math.ceil((Date.parse(session.date_end) - t0) / 1000);

  const driverRows = await openf1<DriverInfo[]>("drivers", { session_key: sessionKey });
  const drivers: ReplayDriver[] = driverRows.map((d) => ({
    num: d.driver_number,
    acronym: d.name_acronym,
    team: d.team_name,
    colour: d.team_colour,
  }));

  const grid = makeGrid(duration, POS_HZ);
  const pos: ReplayBlob["pos"] = {};
  for (const d of drivers) {
    const rows = await openf1<LocationRow[]>("location", {
      session_key: sessionKey,
      driver_number: d.num,
      "date>": session.date_start,
      "date<": new Date(t0 + duration * 1000).toISOString(),
    });
    const clean = rows.filter((r) => r.x !== 0 || r.y !== 0);
    if (clean.length < 10) continue; // no usable data (DNS etc.)
    const xs: TimedSample[] = clean.map((r) => ({ t: (Date.parse(r.date) - t0) / 1000, v: r.x }));
    const ys: TimedSample[] = clean.map((r) => ({ t: (Date.parse(r.date) - t0) / 1000, v: r.y }));
    const missing: [number, number][] = [];
    for (let i = 1; i < clean.length; i++) {
      const start = (Date.parse(clean[i - 1].date) - t0) / 1000;
      const end = (Date.parse(clean[i].date) - t0) / 1000;
      if (end - start > 6) missing.push([Math.round(start * 10) / 10, Math.round(end * 10) / 10]);
    }
    pos[d.num] = {
      x: resampleCatmullRom(xs, grid).map(Math.round),
      y: resampleCatmullRom(ys, grid).map(Math.round),
      lastT: Math.round(xs[xs.length - 1].t),
      missing,
    };
  }

  const positionRows = await openf1<PositionRow[]>("position", { session_key: sessionKey });
  const order = positionRows
    .map((r) => ({ t: Math.max(0, (Date.parse(r.date) - t0) / 1000), num: r.driver_number, pos: r.position }))
    .filter((e) => e.t <= duration)
    .sort((a, b) => a.t - b.t)
    .map((e) => ({ ...e, t: Math.round(e.t * 10) / 10 }));

  const gapGrid = makeGrid(duration, GAP_HZ);
  const gaps: ReplayBlob["gaps"] = {};
  const intervals: NonNullable<ReplayBlob["intervals"]> = {};
  const lapGaps: NonNullable<ReplayBlob["lapGaps"]> = {};
  try {
    const intervalRows = await openf1<IntervalRow[]>("intervals", { session_key: sessionKey });
    for (const d of drivers) {
      const rows = intervalRows.filter((r) => r.driver_number === d.num && typeof r.gap_to_leader === "number");
      if (rows.length >= 2) {
        const samples: TimedSample[] = rows.map((r) => ({
          t: (Date.parse(r.date) - t0) / 1000,
          v: r.gap_to_leader as number,
        }));
        gaps[d.num] = resampleLinear(samples, gapGrid).map((v) => Math.round(v * 10) / 10);
      }
      const aheadRows = intervalRows.filter((r) => r.driver_number === d.num && typeof r.interval === "number");
      if (aheadRows.length >= 2) {
        intervals[d.num] = resampleLinear(
          aheadRows.map((r) => ({ t: (Date.parse(r.date) - t0) / 1000, v: r.interval as number })),
          gapGrid,
        ).map((v) => Math.round(v * 10) / 10);
      }
      const labels = intervalRows
        .filter((r) => r.driver_number === d.num && typeof r.gap_to_leader === "string")
        .map((r) => ({ t: Math.round(((Date.parse(r.date) - t0) / 1000) * 10) / 10, label: String(r.gap_to_leader) }));
      if (labels.length) lapGaps[d.num] = labels;
    }
  } catch {
    // intervals exist only for races — quali/practice replays just skip gaps
  }

  const lapRows = await openf1<LapRow[]>("laps", { session_key: sessionKey }).catch(() => [] as LapRow[]);
  const laps: ReplayBlob["laps"] = {};
  for (const l of lapRows) {
    (laps[l.driver_number] ??= []).push({
      lap: l.lap_number,
      tStart: l.date_start ? Math.round(((Date.parse(l.date_start) - t0) / 1000) * 10) / 10 : null,
      time: l.lap_duration,
      sectors: [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3],
      segments: [l.segments_sector_1 ?? [], l.segments_sector_2 ?? [], l.segments_sector_3 ?? []],
      trap: l.st_speed,
      pitOut: l.is_pit_out_lap,
    });
  }

  const stintRows = await openf1<StintRow[]>("stints", { session_key: sessionKey }).catch(() => [] as StintRow[]);
  const stints: ReplayBlob["stints"] = {};
  for (const s of stintRows) {
    (stints[s.driver_number] ??= []).push({
      compound: s.compound,
      lapStart: s.lap_start,
      lapEnd: s.lap_end,
      tyreAge: s.tyre_age_at_start,
    });
  }

  const rcRows = await openf1<RaceControlRow[]>("race_control", { session_key: sessionKey }).catch(
    () => [] as RaceControlRow[],
  );
  const raceControl: ReplayBlob["raceControl"] = rcRows
    .map((r) => ({
      t: Math.round(((Date.parse(r.date) - t0) / 1000) * 10) / 10,
      category: r.category,
      flag: r.flag,
      scope: r.scope,
      sector: r.sector,
      msg: r.message,
      driver: r.driver_number,
      lap: r.lap_number,
    }))
    .filter((e) => e.t >= 0 && e.t <= duration)
    .sort((a, b) => a.t - b.t);

  const pitRows = await openf1<PitRow[]>("pit", { session_key: sessionKey }).catch(() => [] as PitRow[]);
  const pits: ReplayBlob["pits"] = {};
  for (const p of [...pitRows].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    (pits[p.driver_number] ??= []).push({
      lap: p.lap_number,
      t: Math.round(((Date.parse(p.date) - t0) / 1000) * 10) / 10,
      durationS: p.pit_duration,
      stopDurationS: p.stop_duration ?? null,
    });
  }

  const weatherRows = await openf1<WeatherRow[]>("weather", { session_key: sessionKey }).catch(
    () => [] as WeatherRow[],
  );
  const weather: ReplayBlob["weather"] = weatherRows
    .map((w) => ({
      t: Math.round((Date.parse(w.date) - t0) / 1000),
      airTemp: w.air_temperature,
      trackTemp: w.track_temperature,
      humidity: w.humidity,
      windSpeed: w.wind_speed,
      windDir: w.wind_direction,
      rainfall: w.rainfall,
    }))
    .filter((w) => w.t >= 0 && w.t <= duration)
    .sort((a, b) => a.t - b.t);

  const radioRows = await openf1<RadioRow[]>("team_radio", { session_key: sessionKey }).catch(
    () => [] as RadioRow[],
  );
  const radio: ReplayBlob["radio"] = {};
  for (const r of [...radioRows].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const t = Math.round(((Date.parse(r.date) - t0) / 1000) * 10) / 10;
    if (t < 0 || t > duration) continue;
    (radio[r.driver_number] ??= []).push({ t, url: r.recording_url });
  }

  const [overtakeRows, gridRows, resultRows] = await Promise.all([
    openf1<OvertakeRow[]>("overtakes", { session_key: sessionKey }).catch(() => [] as OvertakeRow[]),
    openf1<StartingGridRow[]>("starting_grid", { session_key: sessionKey }).catch(() => [] as StartingGridRow[]),
    openf1<SessionResultRow[]>("session_result", { session_key: sessionKey }).catch(() => [] as SessionResultRow[]),
  ]);
  const overtakes = overtakeRows.map((row) => ({
    t: Math.round(((Date.parse(row.date) - t0) / 1000) * 10) / 10,
    overtaking: row.overtaking_driver_number,
    overtaken: row.overtaken_driver_number,
    position: row.position,
  })).filter((event) => event.t >= 0 && event.t <= duration);
  const startingGrid = gridRows.map((row) => ({ num: row.driver_number, pos: row.position, lapDuration: row.lap_duration }));
  for (const gridEntry of startingGrid) {
    if (!order.some((event) => event.num === gridEntry.num && event.t === 0)) {
      order.push({ t: 0, num: gridEntry.num, pos: gridEntry.pos });
    }
  }
  order.sort((a, b) => a.t - b.t);
  const result = resultRows.map((row) => ({
    num: row.driver_number,
    pos: row.position,
    status: row.dsq ? "DSQ" : row.dns ? "DNS" : row.dnf ? "DNF" : "CLASSIFIED",
    points: row.points,
  }));

  return {
    version: BAKE_VERSION,
    sessionKey,
    sessionName: session.session_name,
    circuitKey: session.circuit_key,
    sessionYear: session.year,
    t0: session.date_start,
    duration,
    hz: POS_HZ,
    drivers,
    pos,
    order,
    gapHz: GAP_HZ,
    gaps,
    intervals,
    lapGaps,
    stints,
    laps,
    raceControl,
    pits,
    weather,
    radio,
    overtakes,
    startingGrid,
    result,
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ sessionKey: string }> }) {
  const { sessionKey } = await ctx.params;
  if (!/^\d+$/.test(sessionKey)) {
    return NextResponse.json({ error: "bad session key" }, { status: 400 });
  }
  // version in the filename: bumping BAKE_VERSION simply stops matching old
  // blobs — no JSON sniffing, stale versions are ignored on disk
  const file = path.join(BAKE_DIR, `${sessionKey}.v${BAKE_VERSION}.json`);
  try {
    const cached = await readFile(file, "utf8");
    return new NextResponse(cached, { headers: { "content-type": "application/json" } });
  } catch {
    // not baked yet at this version
  }
  try {
    const blob = await bake(Number(sessionKey));
    await mkdir(BAKE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(blob));
    await rm(path.join(BAKE_DIR, `${sessionKey}.json`), { force: true }); // pre-versioning leftover
    return NextResponse.json(blob);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
