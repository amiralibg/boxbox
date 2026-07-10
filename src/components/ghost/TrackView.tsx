"use client";

import { useEffect, useRef } from "react";
import { drawCar, headingBetween } from "@/lib/track/carMarker";
import { makeProjector, type BakedCircuit, type Pt } from "@/lib/track/geometry";
import { sampleLap } from "@/lib/telemetry/sample";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import type { BakedLap } from "@/lib/telemetry/types";
import { chartPalette } from "@/lib/theme";

const TRAIL_S = 1.6; // seconds of trail behind each car

export interface GhostEntry {
  lap: BakedLap;
  color: string;
  label: string;
}

/**
 * TrackRenderer, animated: static track layer + 60fps car dots on canvas.
 * Subscribes to the player clock directly — no React re-renders per frame.
 */
export function TrackView({ circuit, ghosts, player }: { circuit: BakedCircuit; ghosts: GhostEntry[]; player: TelemetryPlayer }) {
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
      const pad = 28;
      projector = makeProjector(circuit, { x: pad, y: pad, width: w - pad * 2, height: h - pad * 2 });
      trackPath = new Path2D();
      projector.trackScreen.forEach(([x, y], i) => (i === 0 ? trackPath!.moveTo(x, y) : trackPath!.lineTo(x, y)));
      trackPath.closePath();
    };

    const headings = new Map<number, number>();
    const draw = (t: number) => {
      if (!projector || !trackPath) return;
      const proj = projector;
      ctx.clearRect(0, 0, w, h);

      // track bed
      const pal = chartPalette();
      ctx.lineJoin = "round";
      ctx.strokeStyle = pal.trackBed;
      ctx.lineWidth = 11;
      ctx.stroke(trackPath);
      ctx.strokeStyle = pal.inkFaint;
      ctx.lineWidth = 1.25;
      ctx.stroke(trackPath);

      // start / finish
      const [sx, sy] = proj.trackScreen[0];
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();

      ghosts.forEach((g, gi) => {
        // trail
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const steps = 14;
        for (let i = 0; i < steps; i++) {
          const ta = Math.max(0, t - TRAIL_S * ((i + 1) / steps));
          const tb = Math.max(0, t - TRAIL_S * (i / steps));
          if (tb <= 0) break;
          const a = sampleLap(g.lap, ta);
          const b = sampleLap(g.lap, tb);
          const pa = proj.project([a.x, a.y] as Pt);
          const pb = proj.project([b.x, b.y] as Pt);
          ctx.globalAlpha = 0.55 * (1 - i / steps);
          ctx.beginPath();
          ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pb[0], pb[1]);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // car marker, headed along travel direction
        const f = sampleLap(g.lap, t);
        const ahead = sampleLap(g.lap, Math.min(t + 0.12, g.lap.lapDuration));
        const [px, py] = proj.project([f.x, f.y] as Pt);
        const [qx, qy] = proj.project([ahead.x, ahead.y] as Pt);
        const heading = headingBetween(px, py, qx, qy, headings.get(gi) ?? 0);
        headings.set(gi, heading);
        drawCar(ctx, px, py, heading, g.color, 1.35, { glow: true });

        // label — staggered per ghost so close cars don't overprint
        ctx.font = "600 11px 'Space Grotesk', sans-serif";
        ctx.fillStyle = g.color;
        const ly = gi % 2 === 0 ? py - 16 : py + 24;
        ctx.fillText(g.label, px + 14, ly);
      });
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
  }, [circuit, ghosts, player]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
