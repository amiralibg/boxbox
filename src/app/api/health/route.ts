import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "boxbox", timestamp: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
