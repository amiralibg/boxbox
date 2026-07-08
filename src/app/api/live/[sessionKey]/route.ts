import { NextRequest } from "next/server";
import { DelayedRestFeed } from "@/lib/server/feeds/delayedRest";
import type { LiveFeed } from "@/lib/live/types";

export const dynamic = "force-dynamic";

/**
 * SSE endpoint wrapping a LiveFeed (spec Part 5). One feed instance per
 * session key fans out to every connected client; the feed stops itself when
 * the last client disconnects. Feed implementation is chosen by env
 * (LIVE_FEED) — only delayed_rest ships today; the sponsor-token MQTT feed
 * would slot in here, keeping the token server-side.
 */
const feeds = new Map<string, LiveFeed>();

function getFeed(sessionKey: number, simulate: boolean, speed: number): LiveFeed {
  const impl = process.env.LIVE_FEED ?? "delayed_rest";
  if (impl !== "delayed_rest") throw new Error(`LIVE_FEED=${impl} not implemented`);
  const id = `${impl}:${sessionKey}:${simulate ? `sim${speed}` : "real"}`;
  let feed = feeds.get(id);
  if (!feed) {
    feed = new DelayedRestFeed(sessionKey, simulate, speed);
    feeds.set(id, feed);
  }
  return feed;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ sessionKey: string }> }) {
  const { sessionKey } = await ctx.params;
  if (!/^\d+$/.test(sessionKey)) {
    return Response.json({ error: "bad session key" }, { status: 400 });
  }
  const simulate = req.nextUrl.searchParams.get("simulate") === "1";
  const speed = Math.min(120, Math.max(1, Number(req.nextUrl.searchParams.get("speed") ?? 1)));

  const feed = getFeed(Number(sessionKey), simulate, speed);
  const meta = await feed.meta();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("meta", meta);

      const unsub = feed.subscribe(
        (frame) => send("frame", frame),
        () => {
          send("end", {});
          cleanup();
        },
      );

      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000);

      let closed = false;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed by the runtime
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
