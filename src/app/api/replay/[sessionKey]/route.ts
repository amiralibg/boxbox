import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import { makeGrid, resampleLinear, type TimedSample } from "@/lib/telemetry/resample";
import type { ReplayBlob, ReplayDriver } from "@/lib/replay/types";
import type { DriverInfo, SessionInfo } from "@/lib/telemetry/types";

const POS_HZ = 2;
const GAP_HZ = 0.25;
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

interface IntervalRow {
  date: string;
  driver_number: number;
  gap_to_leader: number | string | null;
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
    pos[d.num] = {
      x: resampleLinear(xs, grid).map(Math.round),
      y: resampleLinear(ys, grid).map(Math.round),
      lastT: Math.round(xs[xs.length - 1].t),
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
  try {
    const intervalRows = await openf1<IntervalRow[]>("intervals", { session_key: sessionKey });
    for (const d of drivers) {
      const rows = intervalRows.filter((r) => r.driver_number === d.num && typeof r.gap_to_leader === "number");
      if (rows.length < 2) continue;
      const samples: TimedSample[] = rows.map((r) => ({
        t: (Date.parse(r.date) - t0) / 1000,
        v: r.gap_to_leader as number,
      }));
      gaps[d.num] = resampleLinear(samples, gapGrid).map((v) => Math.round(v * 10) / 10);
    }
  } catch {
    // intervals exist only for races — quali/practice replays just skip gaps
  }

  return {
    sessionKey,
    sessionName: session.session_name,
    circuitKey: session.circuit_key,
    t0: session.date_start,
    duration,
    hz: POS_HZ,
    drivers: drivers.filter((d) => pos[d.num]),
    pos,
    order,
    gapHz: GAP_HZ,
    gaps,
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ sessionKey: string }> }) {
  const { sessionKey } = await ctx.params;
  if (!/^\d+$/.test(sessionKey)) {
    return NextResponse.json({ error: "bad session key" }, { status: 400 });
  }
  const file = path.join(BAKE_DIR, `${sessionKey}.json`);
  try {
    const cached = await readFile(file, "utf8");
    return new NextResponse(cached, { headers: { "content-type": "application/json" } });
  } catch {
    // not baked yet
  }
  try {
    const blob = await bake(Number(sessionKey));
    await mkdir(BAKE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(blob));
    return NextResponse.json(blob);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
