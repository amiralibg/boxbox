"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GapChart } from "@/components/replay/GapChart";
import { LapChart } from "@/components/replay/LapChart";
import { RaceControlTicker } from "@/components/replay/RaceControlTicker";
import { ReplayTrack } from "@/components/replay/ReplayTrack";
import { ScrubBar } from "@/components/replay/ScrubBar";
import { StintPaceChart } from "@/components/replay/StintPaceChart";
import { WeatherStrip } from "@/components/replay/WeatherStrip";
import { LoadingLine, StageSkeleton } from "@/components/ui/Loading";
import { EmptyState, PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { compoundStyle, SegmentStrip, TimingTable, TyreChip, type TimingRow } from "@/components/ui/TimingTable";
import { teamColor } from "@/lib/color";
import { useTheme } from "@/lib/theme";
import { fetchCircuit, fetchCircuitIndex } from "@/lib/circuits";
import { deriveFastestLaps, deriveOvertakes, deriveTrackStatus } from "@/lib/replay/derive";
import { TelemetryPlayer } from "@/lib/telemetry/player";
import { gapAt, orderAt, type ReplayBlob, type ReplayLap } from "@/lib/replay/types";
import type { BakedCircuit } from "@/lib/track/geometry";
import type { SessionInfo } from "@/lib/telemetry/types";

const YEARS = [2023, 2024, 2025, 2026];
const SPEEDS = [1, 5, 15, 30, 60];

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body as T;
}

export default function ReplayPage() {
  const [year, setYear] = useState(2026);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [blob, setBlob] = useState<ReplayBlob | null>(null);
  const [circuit, setCircuit] = useState<BakedCircuit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessions([]);
    setMeetingKey(null);
    setSessionKey(null);
    getJson<SessionInfo[]>(`/api/sessions?year=${year}`).then(setSessions).catch((e) => setError(String(e)));
  }, [year]);

  const meetings = useMemo(() => {
    const seen = new Map<number, SessionInfo>();
    for (const s of sessions) if (!seen.has(s.meeting_key)) seen.set(s.meeting_key, s);
    return [...seen.values()];
  }, [sessions]);

  const meetingSessions = useMemo(() => sessions.filter((s) => s.meeting_key === meetingKey), [sessions, meetingKey]);

  useEffect(() => {
    if (!sessionKey) return;
    const session = sessions.find((s) => s.session_key === sessionKey);
    if (!session) return;
    let stale = false;
    setLoading(true);
    setError(null);
    setBlob(null);
    (async () => {
      const index = await fetchCircuitIndex();
      const entry = index.find((c) => c.circuitKey === session.circuit_key);
      if (!entry) throw new Error(`no baked geometry for ${session.circuit_short_name}`);
      const [circ, replayBlob] = await Promise.all([
        fetchCircuit(entry.slug),
        getJson<ReplayBlob>(`/api/replay/${sessionKey}`),
      ]);
      if (stale) return;
      setCircuit(circ);
      setBlob(replayBlob);
    })()
      .catch((e) => !stale && setError(String(e)))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [sessionKey, sessions]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="03" title="Replay" sub="Full-session playback: 20 cars at 2 Hz, race order, gaps, sector times. First load ~1 min, cached after." />

      <Panel className="mt-6 p-4 md:p-5">
        <div className="grid grid-cols-2 gap-3 md:max-w-2xl md:grid-cols-3 md:gap-4">
          <Select
            label="SEASON"
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
            options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <Select
            label="GRAND PRIX"
            value={meetingKey ? String(meetingKey) : null}
            onValueChange={(v) => {
              setMeetingKey(Number(v));
              setSessionKey(null);
            }}
            placeholder="Choose…"
            disabled={meetings.length === 0}
            options={meetings.map((m, i) => ({
              value: String(m.meeting_key),
              label: m.circuit_short_name,
              hint: `R${String(i + 1).padStart(2, "0")} ${m.country_name.toUpperCase().slice(0, 3)}`,
            }))}
          />
          <Select
            label="SESSION"
            value={sessionKey ? String(sessionKey) : null}
            onValueChange={(v) => setSessionKey(Number(v))}
            placeholder="Choose…"
            disabled={!meetingKey}
            options={meetingSessions.map((s) => ({ value: String(s.session_key), label: s.session_name }))}
          />
        </div>
        {loading && (
          <div className="mt-4">
            <LoadingLine>Building session data — ~25 OpenF1 fetches, 60–90 s first time, cached after</LoadingLine>
          </div>
        )}
      </Panel>

      {error && (
        <div className="mt-4 border border-red/30 bg-red/5 px-4 py-3 text-[13px] text-red-deep">{error}</div>
      )}

      {loading && !blob && <StageSkeleton label="BUILDING SESSION" note="20 CARS · 2 HZ" sidebarRows={12} />}

      {!loading && !blob && !error && (
        <EmptyState
          title="No session loaded"
          hint="Pick a season, grand prix and session above. Playback covers running order, gaps, race control, pit stops, stints and lap times."
        />
      )}

      {blob && circuit && <ReplayStage key={blob.sessionKey} blob={blob} circuit={circuit} />}
    </main>
  );
}

function ReplayStage({ blob, circuit }: { blob: ReplayBlob; circuit: BakedCircuit }) {
  const player = useMemo(() => new TelemetryPlayer(blob.duration), [blob]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(15);
  const [highlight, setHighlight] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<{ num: number; pos: number; gap: number | null }[]>([]);
  const clockRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  const theme = useTheme();
  const colors = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of blob.drivers) m.set(d.num, teamColor(d.colour, theme));
    return m;
  }, [blob, theme]);

  const dashed = useMemo(() => {
    const seen = new Set<string>();
    const dash = new Set<number>();
    for (const d of blob.drivers) {
      if (seen.has(d.team)) dash.add(d.num);
      else seen.add(d.team);
    }
    return dash;
  }, [blob]);

  useEffect(() => {
    player.setSpeed(15);
    let lastBoard = -10;
    const unsub = player.subscribe((t) => {
      if (clockRef.current) clockRef.current.textContent = fmtClock(t);
      if (scrubRef.current) scrubRef.current.value = String(t);
      setPlaying(player.playing);
      if (Math.abs(t - lastBoard) < 2 && player.playing) return;
      lastBoard = t;
      const order = orderAt(blob.order, t);
      const board = blob.drivers
        .map((d) => ({ num: d.num, pos: order.get(d.num) ?? 99, gap: blob.gaps[d.num] ? gapAt(blob.gaps[d.num], blob.gapHz, t) : null }))
        .sort((a, b) => a.pos - b.pos);
      setRows(board);
    });
    player.seek(60);
    return () => {
      unsub();
      player.destroy();
    };
  }, [player, blob]);

  const toggleHl = (num: number) =>
    setHighlight((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });

  const byNum = useMemo(() => new Map(blob.drivers.map((d) => [d.num, d])), [blob]);
  const hasStints = Object.keys(blob.stints ?? {}).length > 0;

  // derived race events — client-side so heuristics can change without re-bakes
  const status = useMemo(() => deriveTrackStatus(blob.raceControl ?? []), [blob]);
  const overtakes = useMemo(() => deriveOvertakes(blob.order, blob.pits ?? {}), [blob]);
  const fastestLaps = useMemo(() => deriveFastestLaps(blob.laps ?? {}), [blob]);
  const pitRows: TimingRow[] = useMemo(() => {
    const all = Object.entries(blob.pits ?? {}).flatMap(([num, stops]) =>
      stops.map((p) => ({ num: Number(num), ...p })),
    );
    all.sort((a, b) => (a.durationS ?? Infinity) - (b.durationS ?? Infinity));
    return all.map((p, i) => ({
      key: `${p.num}-${p.lap}`,
      cells: {
        rank: { text: String(i + 1), tone: "muted" as const },
        driver: { text: byNum.get(p.num)?.acronym ?? `#${p.num}`, color: colors.get(p.num) },
        lap: { text: `L${p.lap}`, tone: "muted" as const },
        dur: p.durationS == null ? { text: "—", tone: "muted" as const } : { text: p.durationS.toFixed(1), tone: i === 0 ? ("best" as const) : ("default" as const) },
      },
    }));
  }, [blob, byNum, colors]);
  const totalLaps = useMemo(
    () => Math.max(1, ...Object.values(blob.stints ?? {}).flat().map((s) => s.lapEnd)),
    [blob],
  );
  // stint rows in final running order when we have it
  const stintOrder = useMemo(() => {
    const order = orderAt(blob.order, blob.duration);
    return [...blob.drivers].sort((a, b) => (order.get(a.num) ?? 99) - (order.get(b.num) ?? 99));
  }, [blob]);

  return (
    <div className="mt-6 md:mt-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="overflow-hidden">
            <div className="flex items-baseline justify-between px-4 pt-4">
              <SectionLabel>{circuit.name.toUpperCase()} — {blob.sessionName.toUpperCase()}</SectionLabel>
              <span className="font-mono text-[11px] text-ink-3">{blob.drivers.length} CARS</span>
            </div>
            <div className="aspect-[4/3]">
              <ReplayTrack circuit={circuit} blob={blob} colors={colors} player={player} highlight={highlight} status={status} />
            </div>
          </Panel>

          <Panel className="p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => player.toggle()}
                className="h-9 bg-ink px-5 text-[13px] font-semibold text-paper transition-colors hover:bg-red"
              >
                {playing ? "Pause" : "Play"}
              </button>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    player.setSpeed(s);
                    setSpeedState(s);
                  }}
                  className={`h-9 px-2.5 font-mono text-[12px] transition-colors ${
                    speed === s ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {s}×
                </button>
              ))}
              <span className="ml-auto hidden text-[10px] tracking-[0.2em] text-ink-3 sm:block">SESSION CLOCK</span>
              <span ref={clockRef} className="font-mono text-[13px] tabular-nums text-ink">0:00:00</span>
            </div>
            <div className="mt-3.5">
              <ScrubBar
                ref={scrubRef}
                blob={blob}
                player={player}
                status={status}
                fastestLaps={fastestLaps}
                highlight={highlight}
                colors={colors}
              />
            </div>
            {(blob.weather ?? []).length > 0 && (
              <div className="mt-2 text-right">
                <WeatherStrip weather={blob.weather} player={player} />
              </div>
            )}
          </Panel>
        </div>

        <Panel className="panel-scroll max-h-[560px] overflow-y-auto lg:max-h-none">
          <div className="sticky top-0 z-10 border-b border-ink/15 bg-paper px-4 py-3">
            <SectionLabel>RUNNING ORDER</SectionLabel>
          </div>
          {rows.map((r) => {
            const d = byNum.get(r.num);
            if (!d || r.pos === 99) return null;
            const active = highlight.has(r.num);
            return (
              <button
                key={r.num}
                onClick={() => toggleHl(r.num)}
                className={`flex w-full items-center gap-2.5 border-b border-ink/10 px-4 py-[7px] text-left transition-colors last:border-b-0 ${
                  active ? "bg-paper-3" : "hover:bg-paper-2"
                }`}
              >
                <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-ink-3">{r.pos}</span>
                <span className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: colors.get(r.num) }} />
                <span className="text-[13px] font-semibold">{d.acronym}</span>
                <span className="ml-auto font-mono text-[12px] tabular-nums text-ink-2">
                  {r.pos === 1 ? "LEADER" : r.gap != null ? `+${r.gap.toFixed(1)}` : "—"}
                </span>
              </button>
            );
          })}
          {rows.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-ink-3">Scrub into the session…</div>}
        </Panel>
      </div>

      {((blob.raceControl ?? []).length > 0 || pitRows.length > 0) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel className="max-h-[360px] min-w-0 overflow-hidden">
            <RaceControlTicker
              raceControl={blob.raceControl ?? []}
              overtakes={overtakes}
              fastestLaps={fastestLaps}
              byNum={byNum}
              colors={colors}
              player={player}
            />
          </Panel>
          {pitRows.length > 0 && (
            <Panel className="max-h-[360px] overflow-hidden pb-1 pt-4">
              <SectionLabel className="px-4">PIT STOPS — PIT-LANE TIME</SectionLabel>
              <div className="panel-scroll mt-2 max-h-[300px] overflow-y-auto">
                <TimingTable
                  dense
                  columns={[
                    { key: "rank", header: "", align: "right" },
                    { key: "driver", header: "DRV" },
                    { key: "lap", header: "LAP", align: "right" },
                    { key: "dur", header: "SECONDS", align: "right" },
                  ]}
                  rows={pitRows}
                />
              </div>
            </Panel>
          )}
        </div>
      )}

      {Object.keys(blob.gaps).length > 0 && (
        <Panel className="mt-5 px-3 pb-3 pt-4 md:px-4">
          <SectionLabel className="px-1">GAP TO LEADER</SectionLabel>
          <div className="mt-2">
            <GapChart blob={blob} colors={colors} dashed={dashed} player={player} highlight={highlight} />
          </div>
        </Panel>
      )}

      {blob.order.length > 0 && Object.keys(blob.laps ?? {}).length > 0 && (
        <Panel className="mt-5 px-3 pb-3 pt-4 md:px-4">
          <SectionLabel className="px-1">LAP CHART — POSITION BY LAP</SectionLabel>
          <div className="mt-2">
            <LapChart blob={blob} colors={colors} dashed={dashed} player={player} highlight={highlight} />
          </div>
        </Panel>
      )}

      {Object.keys(blob.laps ?? {}).length > 0 && (
        <Panel className="mt-5 px-3 pb-3 pt-4 md:px-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <SectionLabel>STINT PACE — LAP TIME BY COMPOUND</SectionLabel>
            <span className="font-mono text-[10px] text-ink-3">
              {highlight.size > 0 ? "HIGHLIGHTED DRIVERS" : "WINNER — CLICK THE ORDER TO ADD DRIVERS"} · IN/OUT + SC LAPS EXCLUDED
            </span>
          </div>
          <div className="mt-2">
            <StintPaceChart
              blob={blob}
              nums={highlight.size > 0 ? [...highlight] : stintOrder[0] ? [stintOrder[0].num] : []}
              colors={colors}
              status={status}
              player={player}
            />
          </div>
        </Panel>
      )}

      {Object.keys(blob.laps ?? {}).length > 0 && <DriverLapsPanel blob={blob} colors={colors} defaultNum={stintOrder[0]?.num} />}

      {hasStints && (
        <Panel className="mt-5 px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionLabel>TYRE STRATEGY</SectionLabel>
            <div className="flex items-center gap-3 font-mono text-[10px] text-ink-3">
              {(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"] as const).map((c) => (
                <span key={c} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: compoundStyle(c).color }} />
                  {compoundStyle(c).letter}
                </span>
              ))}
            </div>
          </div>
          <div className="panel-scroll mt-3 overflow-x-auto">
            <div className="min-w-[560px] space-y-[5px]">
              {stintOrder.map((d) => {
                const stints = blob.stints[d.num];
                if (!stints || stints.length === 0) return null;
                return (
                  <div key={d.num} className="flex items-center gap-2.5">
                    <span className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold" style={{ color: colors.get(d.num) }}>
                      {d.acronym}
                    </span>
                    <div className="flex h-[18px] flex-1 gap-[2px]">
                      {stints.map((s, i) => {
                        const style = compoundStyle(s.compound);
                        const laps = s.lapEnd - s.lapStart + 1;
                        return (
                          <div
                            key={i}
                            title={`${s.compound ?? "?"} · L${s.lapStart}–${s.lapEnd}${s.tyreAge ? ` · ${s.tyreAge} laps old` : ""}`}
                            className="flex items-center justify-center font-mono text-[9px] font-bold text-paper"
                            style={{ width: `${(laps / totalLaps) * 100}%`, backgroundColor: style.color, minWidth: 14 }}
                          >
                            {laps >= 4 ? laps : ""}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

const fmtLapTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
};

/**
 * Lap-by-lap timing sheet for one driver: sector times against session /
 * personal bests (purple / green), minisector strip, speed trap, tyre.
 */
function DriverLapsPanel({ blob, colors, defaultNum }: { blob: ReplayBlob; colors: Map<number, string>; defaultNum?: number }) {
  const [num, setNum] = useState<number>(defaultNum ?? blob.drivers[0].num);
  const laps = blob.laps[num] ?? [];

  // session-wide best per sector + best lap, for purple
  const sessionBest = useMemo(() => {
    const best: [number, number, number, number] = [Infinity, Infinity, Infinity, Infinity];
    for (const arr of Object.values(blob.laps)) {
      for (const l of arr) {
        l.sectors.forEach((s, i) => {
          if (s != null && s < best[i]) best[i] = s;
        });
        if (l.time != null && l.time < best[3]) best[3] = l.time;
      }
    }
    return best;
  }, [blob]);

  const personalBest = useMemo(() => {
    const best: [number, number, number, number] = [Infinity, Infinity, Infinity, Infinity];
    for (const l of laps) {
      l.sectors.forEach((s, i) => {
        if (s != null && s < best[i]) best[i] = s;
      });
      if (l.time != null && l.time < best[3]) best[3] = l.time;
    }
    return best;
  }, [laps]);

  const stintFor = (lap: number) => blob.stints[num]?.find((s) => lap >= s.lapStart && lap <= s.lapEnd);

  const tone = (v: number | null, i: number) =>
    v == null ? "muted" : v <= sessionBest[i] ? "best" : v <= personalBest[i] ? "pb" : "default";

  const rows: TimingRow[] = laps.map((l: ReplayLap) => ({
    key: String(l.lap),
    cells: {
      lap: { text: String(l.lap), tone: "muted" },
      s1: l.sectors[0] == null ? { text: "—", tone: "muted" } : { text: l.sectors[0].toFixed(3), tone: tone(l.sectors[0], 0) },
      s2: l.sectors[1] == null ? { text: "—", tone: "muted" } : { text: l.sectors[1].toFixed(3), tone: tone(l.sectors[1], 1) },
      s3: l.sectors[2] == null ? { text: "—", tone: "muted" } : { text: l.sectors[2].toFixed(3), tone: tone(l.sectors[2], 2) },
      mini: { text: <SegmentStrip segments={l.segments} /> },
      time:
        l.time == null
          ? { text: l.pitOut ? "OUT LAP" : "—", tone: "muted" }
          : { text: fmtLapTime(l.time), tone: tone(l.time, 3) },
      trap: l.trap == null ? { text: "—", tone: "muted" } : { text: String(l.trap), tone: "default" },
      tyre: {
        text: (() => {
          const st = stintFor(l.lap);
          return st ? <TyreChip compound={st.compound} title={`${st.compound ?? "?"} · fitted L${st.lapStart}`} /> : "—";
        })(),
      },
    },
  }));

  return (
    <Panel className="mt-5 pb-1 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4">
        <SectionLabel>LAP TIMES — {blob.drivers.find((d) => d.num === num)?.acronym ?? num}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {blob.drivers.map((d) => (
            <button
              key={d.num}
              onClick={() => setNum(d.num)}
              className={`px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
                d.num === num ? "bg-paper-3" : "hover:bg-paper-2"
              }`}
              style={{ color: colors.get(d.num) }}
            >
              {d.acronym}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-scroll mt-2 max-h-[420px] overflow-y-auto">
        <TimingTable
          dense
          columns={[
            { key: "lap", header: "LAP", align: "right" },
            { key: "s1", header: "S1", align: "right" },
            { key: "s2", header: "S2", align: "right" },
            { key: "s3", header: "S3", align: "right" },
            { key: "mini", header: "MINISECTORS" },
            { key: "time", header: "TIME", align: "right" },
            { key: "trap", header: "TRAP", align: "right" },
            { key: "tyre", header: "TYRE", align: "center" },
          ]}
          rows={rows}
        />
      </div>
    </Panel>
  );
}
