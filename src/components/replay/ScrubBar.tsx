"use client";

import { forwardRef, useMemo } from "react";
import type { FastestLapEvent, StatusSpan } from "@/lib/replay/derive";
import type { ReplayBlob } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";

const SPAN_COLOR: Record<string, string | null> = {
  green: null,
  chequered: null,
  yellow: "var(--color-ochre)",
  sc: "var(--color-ochre)",
  vsc: "var(--color-ochre)",
  red: "var(--color-red)",
};

/**
 * Session scrub bar with the race drawn onto it: SC/VSC/yellow/red periods
 * as tinted bands under the slider track, fastest laps as purple ticks, and
 * pit stops (highlighted drivers only — all 20 would be noise) as
 * team-colored ticks.
 */
export const ScrubBar = forwardRef<
  HTMLInputElement,
  {
    blob: ReplayBlob;
    player: TelemetryPlayer;
    status: StatusSpan[];
    fastestLaps: FastestLapEvent[];
    highlight: Set<number>;
    colors: Map<number, string>;
  }
>(function ScrubBar({ blob, player, status, fastestLaps, highlight, colors }, ref) {
  const { duration } = blob;

  const bands = useMemo(() => {
    const out: { from: number; to: number; color: string; label: string }[] = [];
    for (let i = 0; i < status.length; i++) {
      const color = SPAN_COLOR[status[i].status];
      if (!color) continue;
      out.push({
        from: status[i].t,
        to: status[i + 1]?.t ?? duration,
        color,
        label: status[i].status.toUpperCase(),
      });
    }
    return out;
  }, [status, duration]);

  const pitTicks = useMemo(
    () =>
      [...highlight].flatMap((num) =>
        (blob.pits[num] ?? []).map((p) => ({
          t: p.t,
          color: colors.get(num) ?? "var(--color-ink-3)",
          title: `pit L${p.lap}${p.durationS != null ? ` · ${p.durationS.toFixed(1)}s` : ""}`,
        })),
      ),
    [blob, highlight, colors],
  );

  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / duration) * 100))}%`;

  return (
    <div className="relative">
      {/* event layer under the slider: bands span the strip, ticks are hairlines */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[14px] -translate-y-1/2" aria-hidden>
        {bands.map((b, i) => (
          <span
            key={`b${i}`}
            title={b.label}
            className="absolute top-0 h-full opacity-30"
            style={{ left: pct(b.from), width: `calc(${pct(b.to)} - ${pct(b.from)})`, backgroundColor: b.color }}
          />
        ))}
        {fastestLaps.map((f, i) => (
          <span
            key={`f${i}`}
            className="absolute top-0 h-full w-px"
            style={{ left: pct(f.t), backgroundColor: "var(--color-sector-best)" }}
          />
        ))}
        {pitTicks.map((p, i) => (
          <span
            key={`p${i}`}
            className="absolute top-[-3px] h-[20px] w-[2px]"
            style={{ left: pct(p.t), backgroundColor: p.color }}
          />
        ))}
      </div>
      <input
        ref={ref}
        type="range"
        min={0}
        max={duration}
        step={1}
        defaultValue={0}
        onInput={(e) => player.seek(Number(e.currentTarget.value))}
        className="relative w-full"
      />
    </div>
  );
});
