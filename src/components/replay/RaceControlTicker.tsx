"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionLabel } from "@/components/ui/Section";
import type { FastestLapEvent, Overtake } from "@/lib/replay/derive";
import type { RaceControlEvent, ReplayDriver } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

type FeedItem =
  | { t: number; kind: "rc"; rc: RaceControlEvent }
  | { t: number; kind: "overtake"; ot: Overtake }
  | { t: number; kind: "flap"; fl: FastestLapEvent };

type Filter = "all" | "rc" | "moves";

/** chip color per flag / event kind, from theme tokens */
const flagColor = (flag: string | null, category: string): string => {
  if (category === "SafetyCar") return "var(--color-ochre)";
  switch (flag) {
    case "GREEN":
    case "CLEAR":
      return "var(--color-green)";
    case "YELLOW":
    case "DOUBLE YELLOW":
      return "var(--color-ochre)";
    case "RED":
      return "var(--color-red)";
    case "BLUE":
      return "var(--color-blue)";
    default:
      return "var(--color-ink-3)";
  }
};

const flagLabel = (e: RaceControlEvent): string => {
  if (e.category === "SafetyCar") return e.msg.toUpperCase().includes("VIRTUAL") ? "VSC" : "SC";
  if (e.flag) return e.flag;
  return e.category.toUpperCase();
};

/**
 * Race-control feed synced to the playback clock: only messages the replay
 * has reached are shown, newest first. Derived overtakes and fastest-lap
 * events merge into the same stream. Click a row to seek to its moment.
 */
export function RaceControlTicker({
  raceControl,
  overtakes,
  fastestLaps,
  byNum,
  colors,
  player,
}: {
  raceControl: RaceControlEvent[];
  overtakes: Overtake[];
  fastestLaps: FastestLapEvent[];
  byNum: Map<number, ReplayDriver>;
  colors: Map<number, string>;
  player: TelemetryPlayer;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [count, setCount] = useState(0);

  const items = useMemo(() => {
    const all: FeedItem[] = [
      ...raceControl.map((rc): FeedItem => ({ t: rc.t, kind: "rc", rc })),
      ...overtakes.map((ot): FeedItem => ({ t: ot.t, kind: "overtake", ot })),
      ...fastestLaps.map((fl): FeedItem => ({ t: fl.t, kind: "flap", fl })),
    ].sort((a, b) => a.t - b.t);
    if (filter === "rc") return all.filter((i) => i.kind === "rc");
    if (filter === "moves") return all.filter((i) => i.kind !== "rc");
    return all;
  }, [raceControl, overtakes, fastestLaps, filter]);

  // reveal rows as the clock passes them — same 2s-of-session-time throttle
  // as the leaderboard so scrubbing stays cheap
  useEffect(() => {
    let last = -10;
    const unsub = player.subscribe((t) => {
      if (Math.abs(t - last) < 2 && player.playing) return;
      last = t;
      let lo = 0;
      let hi = items.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (items[mid].t <= t) lo = mid + 1;
        else hi = mid;
      }
      setCount(lo);
    });
    return unsub;
  }, [player, items]);

  const visible = items.slice(Math.max(0, count - 120), count).reverse();
  const acr = (num: number | null) => (num != null ? (byNum.get(num)?.acronym ?? `#${num}`) : null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-4 py-3">
        <SectionLabel>RACE CONTROL</SectionLabel>
        <div className="flex gap-1 font-mono text-[10px]">
          {(
            [
              ["all", "ALL"],
              ["rc", "FIA"],
              ["moves", "MOVES"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-2 py-1 transition-colors ${filter === id ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
        {visible.map((item, i) => (
          <button
            key={`${item.t}-${item.kind}-${i}`}
            onClick={() => player.seek(item.t)}
            className="flex w-full items-baseline gap-2.5 border-b border-ink/10 px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-paper-2"
          >
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-3">{fmtClock(item.t)}</span>
            {item.kind === "rc" && (
              <>
                <span
                  className="shrink-0 self-center px-1.5 py-px font-mono text-[9px] font-bold text-paper"
                  style={{ backgroundColor: flagColor(item.rc.flag, item.rc.category) }}
                >
                  {flagLabel(item.rc)}
                </span>
                <span className="min-w-0 text-[12px] leading-snug text-ink-2">{item.rc.msg}</span>
              </>
            )}
            {item.kind === "overtake" && (
              <>
                <span className="shrink-0 self-center bg-paper-3 px-1.5 py-px font-mono text-[9px] font-bold text-ink-2">
                  {item.ot.pitCycle ? "POS" : "PASS"}
                </span>
                <span className="min-w-0 text-[12px] leading-snug text-ink-2">
                  <span className="font-semibold" style={{ color: colors.get(item.ot.num) }}>
                    {acr(item.ot.num)}
                  </span>{" "}
                  {item.ot.pitCycle ? "ahead of" : "passes"}{" "}
                  <span className="font-semibold" style={{ color: colors.get(item.ot.passed) }}>
                    {acr(item.ot.passed)}
                  </span>{" "}
                  for P{item.ot.pos}
                </span>
              </>
            )}
            {item.kind === "flap" && (
              <>
                <span className="shrink-0 self-center px-1.5 py-px font-mono text-[9px] font-bold text-paper" style={{ backgroundColor: "var(--color-sector-best)" }}>
                  FL
                </span>
                <span className="min-w-0 text-[12px] leading-snug text-ink-2">
                  <span className="font-semibold" style={{ color: colors.get(item.fl.num) }}>
                    {acr(item.fl.num)}
                  </span>{" "}
                  fastest lap — {Math.floor(item.fl.time / 60)}:{(item.fl.time % 60).toFixed(3).padStart(6, "0")} (L
                  {item.fl.lap})
                </span>
              </>
            )}
          </button>
        ))}
        {visible.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px] text-ink-3">No messages yet — play or scrub forward.</div>
        )}
      </div>
    </div>
  );
}
