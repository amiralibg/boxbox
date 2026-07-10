import { NextRequest, NextResponse } from "next/server";

const RADIO_HOST = "livetiming.formula1.com";

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "Missing radio source URL" }, { status: 400 });

  let source: URL;
  try {
    source = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid radio source URL" }, { status: 400 });
  }

  if (
    source.protocol !== "https:" ||
    source.hostname !== RADIO_HOST ||
    !source.pathname.startsWith("/static/") ||
    !source.pathname.toLowerCase().endsWith(".mp3")
  ) {
    return NextResponse.json({ error: "Unsupported radio source" }, { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
      redirect: "follow",
      headers: {
        accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.1",
        "user-agent": "BoxBox/1.0",
      },
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.startsWith("audio/") || !upstream.body) {
      return NextResponse.json(
        {
          error: upstream.status === 403
            ? "Formula One has restricted this historical radio archive."
            : `Radio archive returned ${upstream.status}.`,
        },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Radio archive could not be reached." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
