"use client";

import { useEffect, useRef } from "react";
import { drawTelemetryMarker, headingBetween } from "@/lib/track/carMarker";
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
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let projector: ReturnType<typeof makeProjector> | null = null;
    let trackPath: Path2D | null = null;
    let w = 0;
    let h = 0;
    let hits: { id: number; x: number; y: number; label: string; color: string }[] = [];
    let pointer: { x: number; y: number } | null = null;
    let pinnedId: number | null = null;

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
      hits = [];

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

        // compact directional telemetry marker
        const f = sampleLap(g.lap, t);
        const ahead = sampleLap(g.lap, Math.min(t + 0.12, g.lap.lapDuration));
        const [px, py] = proj.project([f.x, f.y] as Pt);
        const [qx, qy] = proj.project([ahead.x, ahead.y] as Pt);
        const heading = headingBetween(px, py, qx, qy, headings.get(gi) ?? 0);
        headings.set(gi, heading);
        drawTelemetryMarker(ctx, px, py, heading, g.color, 1.15, { glow: true, outline: pal.trackBed });
        hits.push({ id: gi, x: px, y: py, label: g.label, color: g.color });
      });
      updateTooltip();
    };

    function updateTooltip() {
      if (!canvas) return;
      const hoverHit = pointer
        ? [...hits].reverse().find((item) => Math.hypot(item.x - pointer!.x, item.y - pointer!.y) <= 15)
        : undefined;
      const hit = pinnedId == null ? hoverHit : hits.find((item) => item.id === pinnedId);
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      canvas.style.cursor = hoverHit ? "pointer" : "default";
      if (!hit) {
        tooltip.style.opacity = "0";
        return;
      }
      tooltip.textContent = hit.label;
      tooltip.style.left = `${Math.min(w - 110, Math.max(8, hit.x + 14))}px`;
      tooltip.style.top = `${Math.max(8, hit.y - 30)}px`;
      tooltip.style.borderColor = hit.color;
      tooltip.style.opacity = "1";
    }
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      updateTooltip();
    };
    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const hit = [...hits].reverse().find((item) => Math.hypot(item.x - point.x, item.y - point.y) <= 22);
      pinnedId = hit && pinnedId !== hit.id ? hit.id : null;
      pointer = event.pointerType === "mouse" ? point : null;
      updateTooltip();
    };
    const onPointerLeave = () => {
      pointer = null;
      canvas.style.cursor = "default";
      if (pinnedId == null && tooltipRef.current) tooltipRef.current.style.opacity = "0";
    };

    rebuild();
    draw(player.t);
    const unsub = player.subscribe(draw);
    const ro = new ResizeObserver(() => {
      rebuild();
      draw(player.t);
    });
    ro.observe(canvas);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    return () => {
      unsub();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [circuit, ghosts, player]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive lap comparison track. Hover or tap a marker to identify the driver." />
      <div ref={tooltipRef} className="pointer-events-none absolute z-10 max-w-[calc(100%-1rem)] overflow-hidden text-ellipsis whitespace-nowrap border-l-2 bg-paper px-2 py-1 font-mono text-[9px] text-ink opacity-0 shadow-lg transition-opacity" />
      <span className="pointer-events-none absolute bottom-2 left-2 bg-paper/90 px-1.5 py-1 font-mono text-[8px] tracking-[0.12em] text-ink-3 md:hidden">
        TAP MARKER · DRIVER ID
      </span>
    </div>
  );
}
