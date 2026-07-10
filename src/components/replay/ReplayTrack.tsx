"use client";

import { useEffect, useRef } from "react";
import { drawCar, headingBetween } from "@/lib/track/carMarker";
import { makeProjector, type BakedCircuit } from "@/lib/track/geometry";
import { sampleXY, type ReplayBlob } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import { chartPalette } from "@/lib/theme";

/**
 * All-cars track canvas. Same pattern as the ghost TrackView: static track
 * bed + imperative 60fps dots driven by the player clock.
 */
export function ReplayTrack({
  circuit,
  blob,
  colors,
  player,
  highlight,
}: {
  circuit: BakedCircuit;
  blob: ReplayBlob;
  colors: Map<number, string>;
  player: TelemetryPlayer;
  highlight: Set<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let projector: ReturnType<typeof makeProjector> | null = null;
    let trackPath: Path2D | null = null;
    let w = 0;
    let h = 0;

    const rebuild = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 26;
      projector = makeProjector(circuit, { x: pad, y: pad, width: w - pad * 2, height: h - pad * 2 });
      trackPath = new Path2D();
      projector.trackScreen.forEach(([x, y], i) => (i === 0 ? trackPath!.moveTo(x, y) : trackPath!.lineTo(x, y)));
      trackPath.closePath();
    };

    const headings = new Map<number, number>();
    const draw = (t: number) => {
      if (!projector || !trackPath) return;
      const hl = highlight;
      const pal = chartPalette();
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.strokeStyle = pal.trackBed;
      ctx.lineWidth = 10;
      ctx.stroke(trackPath);
      ctx.strokeStyle = pal.inkFaint;
      ctx.lineWidth = 1.25;
      ctx.stroke(trackPath);

      const dimOthers = hl.size > 0;
      for (const d of blob.drivers) {
        const ch = blob.pos[d.num];
        if (!ch) continue;
        const retired = t > ch.lastT + 30;
        const [rx, ry] = sampleXY(ch, blob.hz, Math.min(t, ch.lastT));
        const [px, py] = projector.project([rx, ry]);
        const color = colors.get(d.num) ?? pal.axis;
        const focused = hl.has(d.num);
        const alpha = retired ? 0.15 : dimOthers && !focused ? 0.25 : 1;

        const tAhead = Math.min(t + 0.4, ch.lastT);
        const [ax, ay] = sampleXY(ch, blob.hz, tAhead);
        const [qx, qy] = projector.project([ax, ay]);
        const heading = headingBetween(px, py, qx, qy, headings.get(d.num) ?? 0);
        headings.set(d.num, heading);
        drawCar(ctx, px, py, heading, color, focused ? 1.0 : 0.8, { glow: focused, alpha });

        if ((focused || !dimOthers) && !retired) {
          ctx.globalAlpha = alpha;
          ctx.font = "600 10px 'Space Grotesk', sans-serif";
          ctx.fillStyle = color;
          ctx.fillText(d.acronym, px + 12, py - 9);
          ctx.globalAlpha = 1;
        }
      }
    };

    rebuild();
    draw(player.t);
    const unsub = player.subscribe(draw);
    const ro = new ResizeObserver(() => {
      rebuild();
      draw(player.t);
    });
    ro.observe(canvas);
    return () => {
      unsub();
      ro.disconnect();
    };
  }, [circuit, blob, colors, player, highlight]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
