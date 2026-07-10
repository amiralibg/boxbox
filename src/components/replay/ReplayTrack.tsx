"use client";

import { useEffect, useRef } from "react";
import { drawCar, drawTelemetryMarker, headingBetween } from "@/lib/track/carMarker";
import { makeProjector, type BakedCircuit } from "@/lib/track/geometry";
import { statusAt, type StatusSpan, type TrackStatus } from "@/lib/replay/derive";
import { positionIsStale, sampleXY, type ReplayBlob } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import { chartPalette } from "@/lib/theme";

/** track-status → tint CSS var; green/chequered draw the plain bed */
const STATUS_VAR: Partial<Record<TrackStatus, string>> = {
  yellow: "--color-ochre",
  sc: "--color-ochre",
  vsc: "--color-ochre",
  red: "--color-red",
};

const STATUS_BADGE: Partial<Record<TrackStatus, string>> = {
  yellow: "YELLOW",
  sc: "SAFETY CAR",
  vsc: "VSC",
  red: "RED FLAG",
};

/**
 * All-cars track canvas. Same pattern as the ghost TrackView: static track
 * bed + imperative 60fps dots driven by the player clock. When race control
 * has the track under yellow/SC/VSC/red, the bed tints and a badge names it.
 */
export function ReplayTrack({
  circuit,
  blob,
  colors,
  player,
  highlight,
  status = [],
}: {
  circuit: BakedCircuit;
  blob: ReplayBlob;
  colors: Map<number, string>;
  player: TelemetryPlayer;
  highlight: Set<number>;
  status?: StatusSpan[];
}) {
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
      const pad = 26;
      projector = makeProjector(circuit, { x: pad, y: pad, width: w - pad * 2, height: h - pad * 2 });
      trackPath = new Path2D();
      projector.trackScreen.forEach(([x, y], i) => (i === 0 ? trackPath!.moveTo(x, y) : trackPath!.lineTo(x, y)));
      trackPath.closePath();
    };

    const headings = new Map<number, number>();
    const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const draw = (t: number) => {
      if (!projector || !trackPath) return;
      const hl = highlight;
      const pal = chartPalette();
      const st = statusAt(status, t);
      const tintVar = STATUS_VAR[st];
      const tint = tintVar ? cssVar(tintVar) : null;
      ctx.clearRect(0, 0, w, h);
      hits = [];
      ctx.lineJoin = "round";
      ctx.strokeStyle = pal.trackBed;
      ctx.lineWidth = 10;
      ctx.stroke(trackPath);
      if (tint) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = tint;
        ctx.lineWidth = 10;
        ctx.stroke(trackPath);
        ctx.restore();
      }
      ctx.strokeStyle = tint ?? pal.inkFaint;
      ctx.lineWidth = 1.25;
      ctx.stroke(trackPath);
      if (tint) {
        ctx.font = "700 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = tint;
        ctx.textAlign = "right";
        ctx.fillText(STATUS_BADGE[st] ?? "", w - 10, 18);
        ctx.textAlign = "left";
      }

      const dimOthers = hl.size > 0;
      for (const d of blob.drivers) {
        const ch = blob.pos[d.num];
        if (!ch) continue;
        const retired = t > ch.lastT + 30;
        const stale = positionIsStale(ch, t);
        const [rx, ry] = sampleXY(ch, blob.hz, Math.min(t, ch.lastT));
        const [px, py] = projector.project([rx, ry]);
        const color = colors.get(d.num) ?? pal.axis;
        const focused = hl.has(d.num);
        const alpha = retired ? 0.15 : stale ? 0.28 : dimOthers && !focused ? 0.25 : 1;

        const tAhead = Math.min(t + 0.4, ch.lastT);
        const [ax, ay] = sampleXY(ch, blob.hz, tAhead);
        const [qx, qy] = projector.project([ax, ay]);
        const heading = headingBetween(px, py, qx, qy, headings.get(d.num) ?? 0);
        headings.set(d.num, heading);
        if (focused) {
          drawCar(ctx, px, py, heading, color, 1, { glow: true, alpha });
        } else {
          drawTelemetryMarker(ctx, px, py, heading, color, 0.9, { alpha, outline: pal.trackBed });
        }
        hits.push({ id: d.num, x: px, y: py, label: `${d.acronym} · #${d.num} · ${d.team}`, color });

        if ((focused || (!player.playing && !dimOthers)) && !retired) {
          ctx.globalAlpha = alpha;
          ctx.font = "600 10px 'Space Grotesk', sans-serif";
          ctx.fillStyle = color;
          ctx.fillText(d.acronym, px + 12, py - 9);
          ctx.globalAlpha = 1;
        }
      }
      updateTooltip();
    };

    function updateTooltip() {
      if (!canvas) return;
      const hoverHit = pointer
        ? [...hits].reverse().find((item) => Math.hypot(item.x - pointer!.x, item.y - pointer!.y) <= 14)
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
      tooltip.style.left = `${Math.min(w - 150, Math.max(8, hit.x + 14))}px`;
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
      const hit = [...hits].reverse().find((item) => Math.hypot(item.x - point.x, item.y - point.y) <= 20);
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
  }, [circuit, blob, colors, player, highlight, status]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive session track. Hover or tap a car marker to identify the driver." />
      <div ref={tooltipRef} className="pointer-events-none absolute z-10 max-w-[calc(100%-1rem)] overflow-hidden text-ellipsis whitespace-nowrap border-l-2 bg-paper px-2 py-1 font-mono text-[9px] text-ink opacity-0 shadow-lg transition-opacity" />
      <span className="pointer-events-none absolute bottom-2 left-2 bg-paper/90 px-1.5 py-1 font-mono text-[8px] tracking-[0.12em] text-ink-3 md:hidden">
        TAP MARKER · DRIVER ID
      </span>
    </div>
  );
}
