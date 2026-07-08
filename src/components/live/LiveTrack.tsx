"use client";

import { useEffect, useRef } from "react";
import { makeProjector, type BakedCircuit } from "@/lib/track/geometry";
import type { LiveMeta } from "@/lib/live/types";

export interface CarTween {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** wall-clock ms when the target frame arrived */
  at: number;
  /** ms to glide from -> to (≈ the poll interval) */
  over: number;
}

/**
 * Live all-cars canvas. Frames arrive every few seconds; each car glides from
 * its previous position to the newest one over the poll interval, read from a
 * mutable tween map at 60fps — no React state on the hot path.
 */
export function LiveTrack({
  circuit,
  meta,
  colors,
  tweens,
}: {
  circuit: BakedCircuit;
  meta: LiveMeta;
  colors: Map<number, string>;
  tweens: React.RefObject<Map<number, CarTween>>;
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

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!projector || !trackPath) return;
      const proj = projector;
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#23232f";
      ctx.lineWidth = 10;
      ctx.stroke(trackPath);
      ctx.strokeStyle = "#3a3a4a";
      ctx.lineWidth = 1.5;
      ctx.stroke(trackPath);

      const now = performance.now();
      for (const d of meta.drivers) {
        const tw = tweens.current?.get(d.num);
        if (!tw) continue;
        const u = Math.min(1, (now - tw.at) / tw.over);
        const [px, py] = proj.project([tw.fromX + (tw.toX - tw.fromX) * u, tw.fromY + (tw.toY - tw.fromY) * u]);
        const color = colors.get(d.num) ?? "#7e7c92";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0b0b12";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = "600 10px 'Space Grotesk', sans-serif";
        ctx.fillStyle = color;
        ctx.fillText(d.acronym, px + 9, py - 7);
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
  }, [circuit, meta, colors, tweens]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
