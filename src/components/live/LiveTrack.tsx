"use client";

import { useEffect, useRef } from "react";
import { drawCar, headingBetween } from "@/lib/track/carMarker";
import { makeProjector, type BakedCircuit } from "@/lib/track/geometry";
import type { LivePlayback } from "@/lib/live/playback";
import type { LiveMeta } from "@/lib/live/types";
import { chartPalette } from "@/lib/theme";

/**
 * Live all-cars canvas. The playback buffer replays polled frames on a
 * smooth trailing clock; every rAF tick reads interpolated positions from
 * it — no React state on the hot path.
 */
export function LiveTrack({
  circuit,
  meta,
  colors,
  playback,
}: {
  circuit: BakedCircuit;
  meta: LiveMeta;
  colors: Map<number, string>;
  playback: React.RefObject<LivePlayback | null>;
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
    let raf = 0;

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
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!projector || !trackPath) return;
      const proj = projector;
      const pal = chartPalette();
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.strokeStyle = pal.trackBed;
      ctx.lineWidth = 10;
      ctx.stroke(trackPath);
      ctx.strokeStyle = pal.inkFaint;
      ctx.lineWidth = 1.25;
      ctx.stroke(trackPath);

      const pb = playback.current;
      if (!pb || !pb.hasData) return;
      const t = pb.now();
      for (const d of meta.drivers) {
        const pos = pb.posAt(d.num, t);
        if (!pos) continue;
        const [px, py] = proj.project([pos.x, pos.y]);
        const color = colors.get(d.num) ?? pal.axis;
        // heading from a short look-back along the buffered path
        const prev = pb.posAt(d.num, t - 0.4) ?? pos;
        const [qx, qy] = proj.project([prev.x, prev.y]);
        const heading = headingBetween(qx, qy, px, py, headings.get(d.num) ?? 0);
        headings.set(d.num, heading);
        drawCar(ctx, px, py, heading, color, 0.85);
        ctx.font = "600 10px 'Space Grotesk', sans-serif";
        ctx.fillStyle = color;
        ctx.fillText(d.acronym, px + 12, py - 9);
      }
    };

    rebuild();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(rebuild);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [circuit, meta, colors, playback]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
