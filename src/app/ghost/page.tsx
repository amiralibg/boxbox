"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GhostCharts } from "@/components/ghost/GhostCharts";
import { TrackView, type GhostEntry } from "@/components/ghost/TrackView";
import { LoadingLine, StageSkeleton } from "@/components/ui/Loading";
import { EmptyState, PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { SegmentStrip, TimingTable, TyreChip, type TimingRow } from "@/components/ui/TimingTable";
import { distinctPair, teamColor } from "@/lib/color";
import { useTheme } from "@/lib/theme";
import { fetchCircuit, fetchCircuitIndex } from "@/lib/circuits";
import { buildDeltaProfile, deltaAt } from "@/lib/telemetry/delta";
import { TelemetryPlayer } from "@/lib/telemetry/player";
import { sampleLap } from "@/lib/telemetry/sample";
import type { BakedCircuit } from "@/lib/track/geometry";
import type { BakedLap, DriverInfo, SessionInfo } from "@/lib/telemetry/types";

const YEARS = [2023, 2024, 2025, 2026];

const fmtLap = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body as T;
}

export default function GhostPage() {
  const theme = useTheme();
  const [year, setYear] = useState(2026);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [numA, setNumA] = useState<number | null>(null);
  const [numB, setNumB] = useState<number | null>(null);
  const [laps, setLaps] = useState<{ a: BakedLap; b: BakedLap } | null>(null);
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

  const meetingSessions = useMemo(
    () => sessions.filter((s) => s.meeting_key === meetingKey && s.session_name !== "Practice"),
    [sessions, meetingKey],
  );

  useEffect(() => {
    setDrivers([]);
    setNumA(null);
    setNumB(null);
    setLaps(null);
    if (!sessionKey) return;
    getJson<DriverInfo[]>(`/api/drivers?session_key=${sessionKey}`).then(setDrivers).catch((e) => setError(String(e)));
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey || numA == null || numB == null || numA === numB) return;
    const session = sessions.find((s) => s.session_key === sessionKey);
    if (!session) return;
    let stale = false;
    setLoading(true);
    setError(null);
    setLaps(null);
    (async () => {
      const index = await fetchCircuitIndex();
      const entry = index.find((c) => c.circuitKey === session.circuit_key);
      if (!entry) throw new Error(`no baked geometry for circuit ${session.circuit_short_name}`);
      const [circ, a, b] = await Promise.all([
        fetchCircuit(entry.slug),
        getJson<BakedLap>(`/api/fastlap?session_key=${sessionKey}&driver_number=${numA}`),
        getJson<BakedLap>(`/api/fastlap?session_key=${sessionKey}&driver_number=${numB}`),
      ]);
      if (stale) return;
      setCircuit(circ);
      setLaps({ a, b });
    })()
      .catch((e) => !stale && setError(String(e)))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [sessionKey, numA, numB, sessions]);

  const driverA = drivers.find((d) => d.driver_number === numA);
  const driverB = drivers.find((d) => d.driver_number === numB);
  const [colorA, colorB] = distinctPair(
    teamColor(driverA?.team_colour ?? null, theme),
    teamColor(driverB?.team_colour ?? null, theme, theme === "dark" ? "#e63b52" : "#c8102e"),
  );

  const driverOptions = (exclude: number | null) =>
    drivers.map((d) => ({
      value: String(d.driver_number),
      label: d.name_acronym,
      hint: d.team_name.toUpperCase().slice(0, 14),
      disabled: d.driver_number === exclude,
    }));

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="02" title="Ghost lab" sub="Two fastest laps overlaid: 20 Hz telemetry, time delta by lap fraction, sectors and minisectors." />

      <Panel className="mt-6 p-4 md:p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
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
          <Select
            label="DRIVER A"
            value={numA != null ? String(numA) : null}
            onValueChange={(v) => setNumA(Number(v))}
            placeholder="Pick…"
            disabled={drivers.length === 0}
            options={driverOptions(numB)}
          />
          <Select
            label="DRIVER B"
            value={numB != null ? String(numB) : null}
            onValueChange={(v) => setNumB(Number(v))}
            placeholder="Pick…"
            disabled={drivers.length === 0}
            options={driverOptions(numA)}
          />
        </div>
        {loading && (
          <div className="mt-4">
            <LoadingLine>Fetching and resampling telemetry — a few seconds per driver first time, cached after</LoadingLine>
          </div>
        )}
      </Panel>

      {error && (
        <div className="mt-4 border border-red/30 bg-red/5 px-4 py-3 text-[13px] text-red-deep">{error}</div>
      )}

      {loading && !laps && <StageSkeleton label="FASTEST LAPS" note="RESAMPLING TELEMETRY" sidebarRows={6} />}

      {!loading && !laps && !error && (
        <EmptyState
          title="No laps loaded"
          hint="Pick a season, grand prix and session above, then choose two drivers to compare their fastest laps."
        />
      )}

      {laps && circuit && driverA && driverB && (
        <GhostStage
          key={`${sessionKey}-${numA}-${numB}`}
          circuit={circuit}
          lapA={laps.a}
          lapB={laps.b}
          driverA={driverA}
          driverB={driverB}
          colorA={colorA}
          colorB={colorB}
        />
      )}
    </main>
  );
}

function GhostStage({ circuit, lapA, lapB, driverA, driverB, colorA, colorB }: {
  circuit: BakedCircuit;
  lapA: BakedLap;
  lapB: BakedLap;
  driverA: DriverInfo;
  driverB: DriverInfo;
  colorA: string;
  colorB: string;
}) {
  const player = useMemo(() => new TelemetryPlayer(Math.max(lapA.lapDuration, lapB.lapDuration)), [lapA, lapB]);
  const profile = useMemo(() => buildDeltaProfile(lapA, lapB), [lapA, lapB]);
  const gapRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeedState] = useState(1);

  useEffect(() => {
    const unsub = player.subscribe((t) => {
      const d = sampleLap(lapA, t).dist;
      const gap = deltaAt(profile, d);
      if (gapRef.current) {
        gapRef.current.textContent = `${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(3)}`;
        gapRef.current.style.color = gap > 0.005 ? colorB : gap < -0.005 ? colorA : "var(--color-ink)";
      }
      if (clockRef.current) clockRef.current.textContent = fmtLap(t);
      if (scrubRef.current) scrubRef.current.value = String(t);
      setPlaying(player.playing);
    });
    player.play();
    return () => {
      unsub();
      player.destroy();
    };
  }, [player, lapA, profile, colorA, colorB]);

  const ghosts: GhostEntry[] = useMemo(
    () => [
      { lap: lapA, color: colorA, label: driverA.name_acronym },
      { lap: lapB, color: colorB, label: driverB.name_acronym },
    ],
    [lapA, lapB, colorA, colorB, driverA, driverB],
  );

  // sector comparison rows — green = faster of the pair (relative best)
  const sectorRows: TimingRow[] = useMemo(() => {
    const mk = (d: DriverInfo, lap: BakedLap, other: BakedLap, color: string): TimingRow => {
      const cells: TimingRow["cells"] = {
        driver: { text: d.name_acronym, color },
        tyre: {
          text: (
            <span className="flex items-center gap-1.5">
              <TyreChip compound={lap.compound} />
              {lap.tyreAge != null && <span className="text-ink-3">{lap.tyreAge}L</span>}
            </span>
          ),
        },
      };
      lap.sectors.forEach((s, i) => {
        const o = other.sectors[i];
        cells[`s${i + 1}`] = s == null
          ? { text: "—", tone: "muted" }
          : { text: s.toFixed(3), tone: o != null && s < o ? "pb" : "default" };
      });
      cells.lap = { text: fmtLap(lap.lapDuration), tone: lap.lapDuration < other.lapDuration ? "pb" : "default" };
      cells.trap = lap.speedTrap == null ? { text: "—", tone: "muted" } : {
        text: `${lap.speedTrap}`,
        tone: other.speedTrap != null && lap.speedTrap > other.speedTrap ? "pb" : "default",
      };
      return { key: d.name_acronym, cells };
    };
    return [mk(driverA, lapA, lapB, colorA), mk(driverB, lapB, lapA, colorB)];
  }, [driverA, driverB, lapA, lapB, colorA, colorB]);

  return (
    <div className="mt-6 md:mt-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between px-4 pt-4">
            <SectionLabel>{circuit.name.toUpperCase()} — FASTEST LAPS</SectionLabel>
            <span className="font-mono text-[11px] text-ink-3">LAP {lapA.lapNumber} / {lapB.lapNumber}</span>
          </div>
          <div className="aspect-[4/3]">
            <TrackView circuit={circuit} ghosts={ghosts} player={player} />
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="p-5">
            <SectionLabel>GAP AT CAR {driverA.name_acronym}</SectionLabel>
            <div className="mt-2 font-mono text-[52px] font-bold leading-none tabular-nums">
              <span ref={gapRef}>+0.000</span>
              <span className="ml-1.5 text-lg font-normal text-ink-3">s</span>
            </div>
            <div className="mt-5 space-y-2.5">
              {[
                { d: driverA, lap: lapA, color: colorA },
                { d: driverB, lap: lapB, color: colorB },
              ].map(({ d, lap, color }) => (
                <div key={d.driver_number} className="flex items-center gap-2.5">
                  <span className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[13px] font-semibold">{d.name_acronym}</span>
                  <span className="truncate text-[11px] text-ink-3">{d.team_name}</span>
                  <span className="ml-auto font-mono text-[13px] tabular-nums">{fmtLap(lap.lapDuration)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionLabel>PLAYBACK</SectionLabel>
            <div className="mt-3.5 flex items-center gap-2">
              <button
                onClick={() => player.toggle()}
                className="h-9 bg-ink px-5 text-[13px] font-semibold text-paper transition-colors hover:bg-red"
              >
                {playing ? "Pause" : "Play"}
              </button>
              {[0.5, 1, 2].map((s) => (
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
              <span ref={clockRef} className="ml-auto font-mono text-[13px] tabular-nums text-ink-2">0:00.000</span>
            </div>
            <input
              ref={scrubRef}
              type="range"
              min={0}
              max={player.duration}
              step={0.01}
              defaultValue={0}
              onInput={(e) => player.seek(Number(e.currentTarget.value))}
              className="mt-4 w-full"
            />
          </Panel>

          <Panel className="pb-1 pt-4">
            <SectionLabel className="px-4">SECTORS — BEST LAP</SectionLabel>
            <div className="mt-2">
              <TimingTable
                dense
                columns={[
                  { key: "driver", header: "DRV" },
                  { key: "s1", header: "S1", align: "right" },
                  { key: "s2", header: "S2", align: "right" },
                  { key: "s3", header: "S3", align: "right" },
                  { key: "lap", header: "LAP", align: "right" },
                  { key: "trap", header: "TRAP", align: "right" },
                  { key: "tyre", header: "TYRE", align: "center" },
                ]}
                rows={sectorRows}
              />
            </div>
            <div className="mt-2 space-y-2 border-t border-ink/10 px-3 pb-3 pt-3">
              {[
                { d: driverA, lap: lapA, color: colorA },
                { d: driverB, lap: lapB, color: colorB },
              ].map(({ d, lap, color }) => (
                <div key={d.driver_number} className="flex items-center gap-2.5">
                  <span className="w-8 shrink-0 font-mono text-[10px] font-semibold" style={{ color }}>
                    {d.name_acronym}
                  </span>
                  <SegmentStrip segments={lap.segments} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-5 px-3 pb-2 pt-4 md:px-4">
        <SectionLabel className="px-1">TELEMETRY — DISTANCE ALIGNED</SectionLabel>
        <GhostCharts
          lapA={lapA}
          lapB={lapB}
          colorA={colorA}
          colorB={colorB}
          labelA={driverA.name_acronym}
          labelB={driverB.name_acronym}
          player={player}
        />
      </Panel>
    </div>
  );
}
