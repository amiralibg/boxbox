import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import { makeGrid, resampleHold, resampleLinear, type TimedSample } from "@/lib/telemetry/resample";
import type { ReplayTelemetry } from "@/lib/replay/types";
import type { SessionInfo } from "@/lib/telemetry/types";

const HZ = 2;
const VERSION = 1;
const CACHE_DIR = path.join(process.cwd(), ".cache", "replay-telemetry");

interface CarRow {
  date: string;
  speed: number;
  throttle: number;
  brake: number;
  rpm: number;
  n_gear: number;
  drs: number;
}

async function bake(sessionKey: number, driverNumber: number): Promise<ReplayTelemetry> {
  const [session] = await openf1<SessionInfo[]>("sessions", { session_key: sessionKey });
  if (!session) throw new Error(`Unknown session ${sessionKey}`);
  const t0 = Date.parse(session.date_start);
  const duration = Math.max(0, (Date.parse(session.date_end) - t0) / 1000);
  const rows = await openf1<CarRow[]>("car_data", { session_key: sessionKey, driver_number: driverNumber });
  if (rows.length < 2) throw new Error(`No car telemetry for driver ${driverNumber}`);
  const grid = makeGrid(duration, HZ);
  const samples = (key: keyof Pick<CarRow, "speed" | "throttle" | "brake" | "rpm" | "n_gear" | "drs">): TimedSample[] =>
    rows.map((row) => ({ t: (Date.parse(row.date) - t0) / 1000, v: Number(row[key]) }));
  return {
    sessionKey,
    driverNumber,
    hz: HZ,
    t: grid,
    speed: resampleLinear(samples("speed"), grid).map(Math.round),
    throttle: resampleLinear(samples("throttle"), grid).map(Math.round),
    brake: resampleHold(samples("brake"), grid).map(Math.round),
    rpm: resampleLinear(samples("rpm"), grid).map(Math.round),
    gear: resampleHold(samples("n_gear"), grid).map(Math.round),
    drs: resampleHold(samples("drs"), grid).map(Math.round),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionKey: string; driverNumber: string }> },
) {
  const { sessionKey, driverNumber } = await context.params;
  if (!/^\d+$/.test(sessionKey) || !/^\d+$/.test(driverNumber)) {
    return NextResponse.json({ error: "Bad session or driver number" }, { status: 400 });
  }
  const file = path.join(CACHE_DIR, `${sessionKey}-${driverNumber}.v${VERSION}.json`);
  try {
    return new NextResponse(await readFile(file, "utf8"), { headers: { "content-type": "application/json" } });
  } catch {
    // cache miss
  }
  try {
    const telemetry = await bake(Number(sessionKey), Number(driverNumber));
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(telemetry));
    return NextResponse.json(telemetry);
  } catch (error) {
    return NextResponse.json(
      { error: `Driver telemetry is temporarily unavailable. ${String(error)}` },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "2" } },
    );
  }
}
