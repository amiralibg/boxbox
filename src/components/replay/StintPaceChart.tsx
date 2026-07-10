"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { compoundStyle } from "@/components/ui/TimingTable";
import { statusAt, type StatusSpan } from "@/lib/replay/derive";
import type { ReplayBlob } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import { chartPalette, useTheme } from "@/lib/theme";

const FONT = "11px 'Space Grotesk', sans-serif";

const fmtLapTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/**
 * Stint pace: lap time vs lap for the selected drivers, one series per
 * (driver, stint) stroked in the compound color — degradation reads as the
 * upward slope of each segment. In/out laps and laps run under SC/VSC/red
 * are nulled so trends stay clean.
 */
export function StintPaceChart({
  blob,
  nums,
  colors,
  status,
  player,
}: {
  blob: ReplayBlob;
  /** drivers to plot (highlight set, or the winner by default) */
  nums: number[];
  colors: Map<number, string>;
  status: StatusSpan[];
  player: TelemetryPlayer;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const pal = chartPalette();
    // compoundStyle() hands back var(--…) strings for DOM use — canvas needs
    // them resolved against the current theme
    const rootStyle = getComputedStyle(document.documentElement);
    const compoundColor = (compound: string | null) => {
      const c = compoundStyle(compound).color;
      const m = c.match(/^var\((--[\w-]+)\)$/);
      return m ? rootStyle.getPropertyValue(m[1]).trim() : c;
    };

    const maxLap = Math.max(1, ...Object.values(blob.laps).flat().map((l) => l.lap));
    const lapAxis = Array.from({ length: maxLap }, (_, i) => i + 1);

    interface Segment {
      num: number;
      acronym: string;
      compound: string | null;
      ys: (number | null)[];
    }
    const segments: Segment[] = [];

    for (const num of nums) {
      const laps = blob.laps[num];
      const stints = blob.stints[num];
      if (!laps || laps.length === 0) continue;
      const acronym = blob.drivers.find((d) => d.num === num)?.acronym ?? `#${num}`;
      const inLaps = new Set((blob.pits[num] ?? []).map((p) => p.lap));
      const usable = (l: (typeof laps)[number]) => {
        if (l.time == null || l.pitOut || inLaps.has(l.lap)) return false;
        if (l.tStart != null) {
          // any part of the lap under SC/VSC/red/yellow → not representative
          for (const t of [l.tStart, l.tStart + l.time / 2, l.tStart + l.time]) {
            if (statusAt(status, t) !== "green" && statusAt(status, t) !== "chequered") return false;
          }
        }
        return true;
      };
      const stintList = stints && stints.length > 0 ? stints : [{ compound: null, lapStart: 1, lapEnd: maxLap, tyreAge: null }];
      for (const st of stintList) {
        const ys: (number | null)[] = Array(maxLap).fill(null);
        let any = false;
        for (const l of laps) {
          if (l.lap < st.lapStart || l.lap > st.lapEnd || !usable(l)) continue;
          ys[l.lap - 1] = l.time;
          any = true;
        }
        if (any) segments.push({ num, acronym, compound: st.compound, ys });
      }
    }
    if (segments.length === 0) return;

    const data: uPlot.AlignedData = [lapAxis, ...segments.map((s) => s.ys)];

    const playhead: uPlot.Plugin = {
      hooks: {
        draw: (u) => {
          const ctx = u.ctx;
          ctx.save();
          ctx.font = "600 10px 'Space Grotesk', sans-serif";
          // acronym at the end of each driver's final segment
          const lastSeg = new Map<number, Segment>();
          for (const s of segments) lastSeg.set(s.num, s);
          for (const s of lastSeg.values()) {
            let li = s.ys.length - 1;
            while (li > 0 && s.ys[li] == null) li--;
            if (s.ys[li] == null) continue;
            const x = u.valToPos(lapAxis[li], "x", true) + 6;
            const y = u.valToPos(s.ys[li]!, "y", true) + 3;
            ctx.fillStyle = colors.get(s.num) ?? pal.axis;
            ctx.fillText(s.acronym, x, y);
          }
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
        scales: { x: { time: false } },
        series: [
          {},
          ...segments.map((s) => ({
            label: `${s.acronym} ${s.compound ?? ""}`,
            stroke: compoundColor(s.compound),
            width: 1.75,
            points: { show: true, size: 4, fill: compoundColor(s.compound) },
            spanGaps: true,
            alpha: 1,
          })),
        ],
        axes: [
          { stroke: pal.axis, font: FONT, grid: { stroke: pal.grid, width: 1 }, ticks: { stroke: pal.grid, width: 1 }, values: (_u, vals) => vals.map((v) => `L${v}`) },
          { stroke: pal.axis, font: FONT, size: 52, grid: { stroke: pal.grid, width: 1 }, ticks: { stroke: pal.grid, width: 1 }, values: (_u, vals) => vals.map(fmtLapTime) },
        ],
        plugins: [playhead],
      },
      data,
      host,
    );

    const ro = new ResizeObserver(() => u.setSize({ width: host.clientWidth, height: 260 }));
    ro.observe(host);
    return () => {
      ro.disconnect();
      u.destroy();
    };
  }, [blob, nums, colors, status, player, theme]);

  return <div ref={hostRef} />;
}
