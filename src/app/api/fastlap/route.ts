import { NextRequest, NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import { makeGrid, resampleCatmullRom, resampleHold, resampleLinear, type TimedSample } from "@/lib/telemetry/resample";
import type { BakedLap } from "@/lib/telemetry/types";

const GRID_HZ = 20;
const PAD_S = 2; // fetch window padding so interpolation has neighbours at lap edges

interface OpenF1Lap {
  lap_number: number;
  lap_duration: number | null;
  date_start: string | null;
  is_pit_out_lap: boolean;
}

interface LocationRow {
  date: string;
  x: number;
  y: number;
}

interface CarDataRow {
  date: string;
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  drs: number;
}

function toSamples<R extends { date: string }>(rows: R[], t0: number, pick: (r: R) => number): TimedSample[] {
  return rows.map((r) => ({ t: (Date.parse(r.date) - t0) / 1000, v: pick(r) }));
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const sessionKey = p.get("session_key");
  const driverNumber = p.get("driver_number");
  if (!sessionKey || !driverNumber || !/^\d+$/.test(sessionKey) || !/^\d+$/.test(driverNumber)) {
    return NextResponse.json({ error: "session_key and driver_number required" }, { status: 400 });
  }

  try {
    const laps = await openf1<OpenF1Lap[]>("laps", { session_key: sessionKey, driver_number: driverNumber });
    const valid = laps.filter((l) => l.lap_duration != null && l.date_start != null && !l.is_pit_out_lap);
    if (valid.length === 0) {
      return NextResponse.json({ error: "no timed laps for this driver" }, { status: 404 });
    }
    const best = valid.reduce((a, b) => (b.lap_duration! < a.lap_duration! ? b : a));
    const t0 = Date.parse(best.date_start!);
    const dur = best.lap_duration!;
    const windowStart = new Date(t0 - PAD_S * 1000).toISOString();
    const windowEnd = new Date(t0 + (dur + PAD_S) * 1000).toISOString();

    const [locations, carData] = [
      await openf1<LocationRow[]>("location", {
        session_key: sessionKey,
        driver_number: driverNumber,
        "date>": windowStart,
        "date<": windowEnd,
      }),
      await openf1<CarDataRow[]>("car_data", {
        session_key: sessionKey,
        driver_number: driverNumber,
        "date>": windowStart,
        "date<": windowEnd,
      }),
    ];

    const locs = locations.filter((r) => r.x !== 0 || r.y !== 0); // (0,0) = missing fix
    if (locs.length < 10 || carData.length < 10) {
      return NextResponse.json({ error: "insufficient telemetry for this lap" }, { status: 404 });
    }

    const grid = makeGrid(dur, GRID_HZ);
    const x = resampleCatmullRom(toSamples(locs, t0, (r) => r.x), grid);
    const y = resampleCatmullRom(toSamples(locs, t0, (r) => r.y), grid);
    const speed = resampleLinear(toSamples(carData, t0, (r) => r.speed), grid);
    const throttle = resampleLinear(toSamples(carData, t0, (r) => r.throttle), grid);
    const brake = resampleLinear(toSamples(carData, t0, (r) => r.brake), grid);
    const gear = resampleHold(toSamples(carData, t0, (r) => r.n_gear), grid);
    const drsRaw = resampleHold(toSamples(carData, t0, (r) => r.drs), grid);

    // cumulative distance in metres (coords are ~decimetres)
    const dist: number[] = [0];
    for (let i = 1; i < grid.length; i++) {
      dist.push(dist[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]) / 10);
    }

    const baked: BakedLap = {
      sessionKey: Number(sessionKey),
      driverNumber: Number(driverNumber),
      lapNumber: best.lap_number,
      lapDuration: dur,
      hz: GRID_HZ,
      t: grid,
      x: x.map((v) => Math.round(v)),
      y: y.map((v) => Math.round(v)),
      dist: dist.map((v) => Math.round(v * 10) / 10),
      speed: speed.map((v) => Math.round(v)),
      throttle: throttle.map((v) => Math.round(v)),
      brake: brake.map((v) => Math.round(v)),
      gear: gear.map((v) => Math.round(v)),
      drs: drsRaw.map((v) => v >= 10), // OpenF1 DRS codes: 10/12/14 = open
    };
    return NextResponse.json(baked);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
