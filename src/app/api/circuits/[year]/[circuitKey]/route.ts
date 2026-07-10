import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import type { BakedCircuit } from "@/lib/track/geometry";
import type { SessionInfo } from "@/lib/telemetry/types";

const CACHE_DIR = path.join(process.cwd(), ".cache", "circuits");

interface MultiViewerCircuit {
  circuitName: string;
  rotation: number;
  x: number[];
  y: number[];
  corners: { number: number; trackPosition: { x: number; y: number } }[];
}

export async function GET(_request: Request, context: { params: Promise<{ year: string; circuitKey: string }> }) {
  const { year: yearString, circuitKey: keyString } = await context.params;
  if (!/^\d{4}$/.test(yearString) || !/^\d+$/.test(keyString)) return NextResponse.json({ error: "Bad year or circuit key" }, { status: 400 });
  const year = Number(yearString);
  const circuitKey = Number(keyString);
  if (year < 2023 || year > new Date().getUTCFullYear()) return NextResponse.json({ error: "OpenF1 circuit discovery begins in 2023" }, { status: 404 });
  const file = path.join(CACHE_DIR, `${circuitKey}-${year}.json`);
  try {
    return new NextResponse(await readFile(file, "utf8"), { headers: { "content-type": "application/json" } });
  } catch {
    // cache miss
  }
  try {
    const sessions = await openf1<SessionInfo[]>("sessions", { year, circuit_key: circuitKey });
    const session = sessions[0];
    if (!session) return NextResponse.json({ error: "No OpenF1 session for this circuit/year" }, { status: 404 });
    const response = await fetch(`https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${year}`);
    if (!response.ok) return NextResponse.json({ error: `Geometry provider returned ${response.status}` }, { status: 404 });
    const source = await response.json() as MultiViewerCircuit;
    const slug = `${session.circuit_short_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${year}`;
    const circuit: BakedCircuit = {
      slug,
      circuitKey,
      name: source.circuitName,
      shortName: session.circuit_short_name,
      location: session.circuit_short_name,
      country: session.country_name,
      year,
      rotation: source.rotation,
      x: source.x.map(Math.round),
      y: source.y.map(Math.round),
      corners: source.corners.map((corner) => ({ number: corner.number, x: Math.round(corner.trackPosition.x), y: Math.round(corner.trackPosition.y) })),
    };
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(circuit));
    return NextResponse.json(circuit);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
