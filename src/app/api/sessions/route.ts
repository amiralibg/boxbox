import { NextRequest, NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import type { SessionInfo } from "@/lib/telemetry/types";

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year");
  if (!year || !/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: "year required" }, { status: 400 });
  }
  try {
    const sessions = await openf1<SessionInfo[]>("sessions", { year });
    return NextResponse.json(sessions);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
