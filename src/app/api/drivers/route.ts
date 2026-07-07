import { NextRequest, NextResponse } from "next/server";
import { openf1 } from "@/lib/server/openf1";
import type { DriverInfo } from "@/lib/telemetry/types";

export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("session_key");
  if (!sessionKey || !/^\d+$/.test(sessionKey)) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const drivers = await openf1<DriverInfo[]>("drivers", { session_key: sessionKey });
    return NextResponse.json(drivers);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
