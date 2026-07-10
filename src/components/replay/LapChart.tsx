"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { lapAtTime, lapStartTimes } from "@/lib/replay/derive";
import type { ReplayBlob } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import { chartPalette, useTheme } from "@/lib/theme";

const FONT = "11px 'Space Grotesk', sans-serif";

/**
 * Classic lap chart: position vs lap, one stepped line per driver, leader on
 * top. Same architecture as GapChart — playhead in a draw hook, rAF redraw,
 * click-to-seek, highlight via series alpha, acronyms at line ends.
 */
export function LapChart({
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
    const starts = lapStartTimes(blob.laps);
    const maxLap = Math.max(0, ...Object.values(blob.laps).flat().map((lap) => lap.lap));
    if (maxLap < 2) return;

    const lapAxis = Array.from({ length: maxLap }, (_, i) => i + 1);
    const series = new Map<number, (number | null)[]>(blob.drivers.map((d) => [d.num, Array(maxLap).fill(null)]));
    for (const driver of blob.drivers) {
      const events = blob.order.filter((event) => event.num === driver.num);
      for (const lap of blob.laps[driver.num] ?? []) {
        if (lap.tStart == null) continue;
        let position: number | null = null;
        for (const event of events) {
          if (event.t > lap.tStart) break;
          position = event.pos;
        }
        series.get(driver.num)![lap.lap - 1] = position;
      }
    }

    const data: uPlot.AlignedData = [lapAxis, ...blob.drivers.map((d) => series.get(d.num)!)];

    const playhead: uPlot.Plugin = {
      hooks: {
        draw: (u) => {
          const ctx = u.ctx;
          ctx.save();
          const frac = lapAtTime(starts, player.t);
          if (frac != null) {
            const cx = u.valToPos(frac, "x", true);
            ctx.strokeStyle = pal.ink;
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, u.bbox.top);
            ctx.lineTo(cx, u.bbox.top + u.bbox.height);
            ctx.stroke();
          }
          ctx.font = "600 10px 'Space Grotesk', sans-serif";
          const hl = hlRef.current;
          blob.drivers.forEach((d, i) => {
            const s = data[i + 1] as (number | null)[];
            let li = s.length - 1;
            while (li > 0 && s[li] == null) li--;
            if (s[li] == null) return;
            const x = u.valToPos(lapAxis[li], "x", true) + 6;
            const y = u.valToPos(s[li]!, "y", true) + 3;
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
        height: 300,
        padding: [8, 44, 0, 0],
        legend: { show: false },
        cursor: { y: false, points: { size: 6 } },
        scales: { x: { time: false }, y: { dir: -1, range: [1, blob.drivers.length] } },
        series: [
          {},
          ...blob.drivers.map((d) => ({
            label: d.acronym,
            stroke: colors.get(d.num) ?? pal.axis,
            width: 1.5,
            dash: dashed.has(d.num) ? [5, 4] : undefined,
            paths: uPlot.paths.stepped!({ align: 1 }),
            points: { show: false },
            alpha: 1,
          })),
        ],
        axes: [
          { stroke: pal.axis, font: FONT, grid: { stroke: pal.grid, width: 1 }, ticks: { stroke: pal.grid, width: 1 }, values: (_u, vals) => vals.map((v) => `L${v}`) },
          { stroke: pal.axis, font: FONT, size: 48, grid: { stroke: pal.grid, width: 1 }, ticks: { stroke: pal.grid, width: 1 }, incrs: [1, 2, 5], values: (_u, vals) => vals.map((v) => `P${v}`) },
        ],
        plugins: [playhead],
      },
      data,
      host,
    );

    u.over.addEventListener("mousedown", (e) => {
      const rect = u.over.getBoundingClientRect();
      const lap = Math.round(u.posToVal(e.clientX - rect.left, "x"));
      const t = starts[Math.min(Math.max(1, lap), maxLap)];
      if (!Number.isNaN(t)) player.seek(t);
    });

    let raf = 0;
    let last = -1;
    let highlightApplied = hlRef.current;
    const applyHighlight = () => {
      const hl = hlRef.current;
      highlightApplied = hl;
      blob.drivers.forEach((d, i) => {
        (u.series[i + 1] as uPlot.Series & { alpha: number }).alpha = hl.size > 0 && !hl.has(d.num) ? 0.18 : 1;
      });
    };
    const loop = () => {
      if (player.t !== last || hlRef.current !== highlightApplied) {
        last = player.t;
        applyHighlight();
        u.redraw(false, false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => u.setSize({ width: host.clientWidth, height: 300 }));
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
