"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { type ReplayBlob } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import { chartPalette, useTheme } from "@/lib/theme";

const FONT = "11px 'Space Grotesk', sans-serif";

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}m`;
};

/**
 * Race gap chart: gap to leader over session time, one line per driver,
 * y inverted (leader on top). Acronym labels at line ends instead of a
 * 20-entry legend box; hover names the nearest series.
 */
export function GapChart({
  blob,
  colors,
  dashed,
  player,
  highlight,
}: {
  blob: ReplayBlob;
  colors: Map<number, string>;
  dashed: Set<number>;
  player: TelemetryPlayer;
  highlight: Set<number>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef(highlight);
  const theme = useTheme();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const pal = chartPalette();
    const withGaps = blob.drivers.filter((d) => blob.gaps[d.num]);
    if (withGaps.length === 0) return;

    const n = blob.gaps[withGaps[0].num].length;
    const ts = Array.from({ length: n }, (_, i) => i / blob.gapHz);
    const data: uPlot.AlignedData = [ts, ...withGaps.map((d) => blob.gaps[d.num])];

    const playhead: uPlot.Plugin = {
      hooks: {
        draw: (u) => {
          const cx = u.valToPos(player.t, "x", true);
          const ctx = u.ctx;
          ctx.save();
          ctx.strokeStyle = pal.ink;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, u.bbox.top);
          ctx.lineTo(cx, u.bbox.top + u.bbox.height);
          ctx.stroke();
          // acronym labels at line ends
          ctx.font = "600 10px 'Space Grotesk', sans-serif";
          ctx.globalAlpha = 1;
          const hl = hlRef.current;
          withGaps.forEach((d, i) => {
            const series = data[i + 1] as (number | null)[];
            let li = series.length - 1;
            while (li > 0 && series[li] == null) li--;
            if (series[li] == null) return;
            const x = u.valToPos(ts[li], "x", true) + 6;
            const y = u.valToPos(series[li]!, "y", true) + 3;
            ctx.globalAlpha = hl.size > 0 && !hl.has(d.num) ? 0.3 : 1;
            ctx.fillStyle = colors.get(d.num) ?? pal.axis;
            ctx.fillText(d.acronym, x, y);
          });
          ctx.restore();
        },
      },
    };

    const u = new uPlot(
      {
        width: host.clientWidth,
        height: 260,
        padding: [8, 44, 0, 0],
        legend: { show: false },
        cursor: { y: false, points: { size: 6 } },
        scales: { x: { time: false }, y: { dir: -1 } },
        series: [
          {},
          ...withGaps.map((d) => ({
            label: d.acronym,
            stroke: colors.get(d.num) ?? pal.axis,
            width: 1.5,
            dash: dashed.has(d.num) ? [5, 4] : undefined,
            points: { show: false },
            alpha: 1,
          })),
        ],
        axes: [
          { stroke: pal.axis, font: FONT, grid: { stroke: pal.grid, width: 1 }, ticks: { stroke: pal.grid, width: 1 }, values: (_u, vals) => vals.map(fmtClock) },
          { stroke: pal.axis, font: FONT, size: 48, grid: { stroke: pal.grid, width: 1 }, ticks: { stroke: pal.grid, width: 1 }, values: (_u, vals) => vals.map((v) => `+${v}s`) },
        ],
        plugins: [playhead],
      },
      data,
      host,
    );

    u.over.addEventListener("mousedown", (e) => {
      const rect = u.over.getBoundingClientRect();
      player.seek(u.posToVal(e.clientX - rect.left, "x"));
    });

    let raf = 0;
    let last = -1;
    const loop = () => {
      if (player.t !== last || hlRef.current !== highlightApplied) {
        last = player.t;
        applyHighlight();
        u.redraw(false, false);
      }
      raf = requestAnimationFrame(loop);
    };
    let highlightApplied = hlRef.current;
    const applyHighlight = () => {
      const hl = hlRef.current;
      highlightApplied = hl;
      withGaps.forEach((d, i) => {
        (u.series[i + 1] as uPlot.Series & { alpha: number }).alpha = hl.size > 0 && !hl.has(d.num) ? 0.18 : 1;
      });
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => u.setSize({ width: host.clientWidth, height: 260 }));
    ro.observe(host);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      u.destroy();
    };
  }, [blob, colors, dashed, player, theme]);

  useEffect(() => {
    hlRef.current = highlight;
  }, [highlight]);

  return <div ref={hostRef} />;
}
