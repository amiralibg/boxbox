"use client";

import { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import { buildDeltaProfile } from "@/lib/telemetry/delta";
import { sampleLap, timeAtDistance } from "@/lib/telemetry/sample";
import type { TelemetryPlayer } from "@/lib/telemetry/player";
import type { BakedLap } from "@/lib/telemetry/types";
import { chartPalette, useTheme } from "@/lib/theme";

const FONT = "11px 'Space Grotesk', sans-serif";
const POINTS = 600;

interface Props {
  lapA: BakedLap;
  lapB: BakedLap;
  colorA: string;
  colorB: string;
  labelA: string;
  labelB: string;
  player: TelemetryPlayer;
}

interface ChartSpec {
  title: string;
  unit: string;
  data: uPlot.AlignedData;
  series: uPlot.Series[];
  height: number;
  showX: boolean;
  zeroLine?: boolean;
}

/**
 * ChartLayer: small multiples of speed/throttle/brake vs distance, plus the
 * time-delta trace. One x-axis (distance) shared by cursor sync; the playhead
 * line follows the player clock via a draw-hook redraw at animation rate.
 */
export function GhostCharts({ lapA, lapB, colorA, colorB, labelA, labelB, player }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const prepared = useMemo(() => {
    // match samples by lap-progress fraction (see buildDeltaProfile)
    const totalA = lapA.dist[lapA.dist.length - 1];
    const totalB = lapB.dist[lapB.dist.length - 1];
    const s = Array.from({ length: POINTS + 1 }, (_, i) => (totalA * i) / POINTS);
    const atA = s.map((d) => sampleLap(lapA, timeAtDistance(lapA, d)));
    const atB = Array.from({ length: POINTS + 1 }, (_, i) =>
      sampleLap(lapB, timeAtDistance(lapB, (totalB * i) / POINTS)),
    );
    const delta = buildDeltaProfile(lapA, lapB, POINTS);
    return { s, atA, atB, delta };
  }, [lapA, lapB]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    const pal = chartPalette();
    const plots: uPlot[] = [];
    const { s, atA, atB, delta } = prepared;

    const mkSeries = (label: string, color: string, dash?: number[]): uPlot.Series => ({
      label,
      stroke: color,
      width: 2,
      dash,
      points: { show: false },
    });

    const axisBase: uPlot.Axis = {
      stroke: pal.axis,
      font: FONT,
      grid: { stroke: pal.grid, width: 1 },
      ticks: { stroke: pal.grid, width: 1 },
    };

    const specs: ChartSpec[] = [
      {
        title: "SPEED",
        unit: "km/h",
        height: 170,
        showX: false,
        data: [s, atA.map((f) => f.speed), atB.map((f) => f.speed)],
        series: [{}, mkSeries(labelA, colorA), mkSeries(labelB, colorB, [6, 4])],
      },
      {
        title: "THROTTLE",
        unit: "%",
        height: 90,
        showX: false,
        data: [s, atA.map((f) => f.throttle), atB.map((f) => f.throttle)],
        series: [{}, mkSeries(labelA, colorA), mkSeries(labelB, colorB, [6, 4])],
      },
      {
        title: "BRAKE",
        unit: "%",
        height: 90,
        showX: false,
        data: [s, atA.map((f) => f.brake), atB.map((f) => f.brake)],
        series: [{}, mkSeries(labelA, colorA), mkSeries(labelB, colorB, [6, 4])],
      },
      {
        title: `DELTA  ${labelA} vs ${labelB}`,
        unit: "s",
        height: 120,
        showX: true,
        zeroLine: true,
        data: [delta.s, delta.delta],
        series: [{}, mkSeries("Δ", pal.ink)],
      },
    ];

    const sync = uPlot.sync("ghost-x");

    for (const spec of specs) {
      const wrap = document.createElement("div");
      wrap.className = "border-b border-ink/10 last:border-b-0";
      const head = document.createElement("div");
      head.className = "flex items-baseline justify-between px-1 pt-3";
      head.innerHTML = `<span class="text-[11px] font-medium tracking-[0.18em] text-ink-3">${spec.title}</span><span class="readout font-mono text-[11px] text-ink-2"></span>`;
      wrap.appendChild(head);
      host.appendChild(wrap);
      const readout = head.querySelector<HTMLElement>(".readout")!;

      const playheadPlugin: uPlot.Plugin = {
        hooks: {
          draw: (u) => {
            const t = player.t;
            const d = sampleLap(lapA, t).dist;
            const cx = u.valToPos(d, "x", true);
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = pal.ink;
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, u.bbox.top);
            ctx.lineTo(cx, u.bbox.top + u.bbox.height);
            ctx.stroke();
            if (spec.zeroLine) {
              const zy = u.valToPos(0, "y", true);
              ctx.globalAlpha = 0.35;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(u.bbox.left, zy);
              ctx.lineTo(u.bbox.left + u.bbox.width, zy);
              ctx.stroke();
            }
            ctx.restore();
          },
          setCursor: (u) => {
            const idx = u.cursor.idx;
            if (idx == null) {
              readout.textContent = "";
              return;
            }
            const vals = spec.data.slice(1).map((arr) => arr![idx]);
            readout.textContent =
              vals.length === 2
                ? `${labelA} ${Math.round(vals[0]!)} · ${labelB} ${Math.round(vals[1]!)} ${spec.unit}`
                : `${(vals[0]! >= 0 ? "+" : "")}${vals[0]!.toFixed(3)} ${spec.unit}`;
          },
        },
      };

      const opts: uPlot.Options = {
        width: host.clientWidth,
        height: spec.height,
        series: spec.series,
        legend: { show: false },
        cursor: {
          sync: { key: "ghost-x", setSeries: false },
          y: false,
          points: { size: 7 },
        },
        scales: { x: { time: false } },
        axes: [
          {
            ...axisBase,
            show: spec.showX,
            values: (u, vals) => vals.map((v) => `${(v / 1000).toFixed(1)}km`),
          },
          { ...axisBase, size: 52 },
        ],
        plugins: [playheadPlugin],
      };

      const u = new uPlot(opts, spec.data, wrap);
      sync.sub(u);
      plots.push(u);

      // click-to-seek
      u.over.addEventListener("mousedown", (e) => {
        const rect = u.over.getBoundingClientRect();
        const d = u.posToVal(e.clientX - rect.left, "x");
        player.seek(timeAtDistance(lapA, d));
      });
    }

    // playhead follows the clock
    let raf = 0;
    let last = -1;
    const loop = () => {
      if (player.t !== last) {
        last = player.t;
        for (const u of plots) u.redraw(false, false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      for (const u of plots) u.setSize({ width: host.clientWidth, height: u.height });
    });
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const u of plots) u.destroy();
      host.innerHTML = "";
    };
  }, [prepared, colorA, colorB, labelA, labelB, player, lapA, theme]);

  return <div ref={hostRef} />;
}
