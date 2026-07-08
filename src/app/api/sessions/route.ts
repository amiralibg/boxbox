import { NextRequest, NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import type { SessionInfo } from "@/lib/telemetry/types";

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year");
  if (!year || !/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: "year required" }, { status: 400 });
  }
  try {
    // current season keeps growing — 1h TTL; past seasons are immutable
    const currentYear = Number(year) >= new Date().getUTCFullYear();
    const sessions = await openf1<SessionInfo[]>("sessions", { year }, currentYear ? { maxAgeMs: 3_600_000 } : {});
    // the calendar includes FUTURE races — no data behind them yet
    const now = Date.now();
    return NextResponse.json(sessions.filter((s) => Date.parse(s.date_start) <= now));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
