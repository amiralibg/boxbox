"use client";

import { useEffect, useRef } from "react";
import { makeProjector, type BakedCircuit, type Pt } from "@/lib/track/geometry";
import { sampleLap } from "@/lib/telemetry/sample";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import type { BakedLap } from "@/lib/telemetry/types";

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

    const draw = (t: number) => {
      if (!projector || !trackPath) return;
      ctx.clearRect(0, 0, w, h);

      // track bed
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#23232f";
      ctx.lineWidth = 11;
      ctx.stroke(trackPath);
      ctx.strokeStyle = "#3a3a4a";
      ctx.lineWidth = 1.5;
      ctx.stroke(trackPath);

      // start / finish
      const [sx, sy] = projector.trackScreen[0];
      ctx.fillStyle = "#eceaf6";
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
          const pa = projector.project([a.x, a.y] as Pt);
          const pb = projector.project([b.x, b.y] as Pt);
          ctx.globalAlpha = 0.55 * (1 - i / steps);
          ctx.beginPath();
          ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pb[0], pb[1]);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // car dot
        const f = sampleLap(g.lap, t);
        const [px, py] = projector.project([f.x, f.y] as Pt);
        ctx.shadowColor = g.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#0b0b12";
        ctx.lineWidth = 2;
        ctx.stroke();

        // label — staggered per ghost so close cars don't overprint
        ctx.font = "600 11px 'Space Grotesk', sans-serif";
        ctx.fillStyle = g.color;
        const ly = gi % 2 === 0 ? py - 12 : py + 20;
        ctx.fillText(g.label, px + 11, ly);
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
