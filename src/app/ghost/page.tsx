"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GhostCharts } from "@/components/ghost/GhostCharts";
import { TrackView, type GhostEntry } from "@/components/ghost/TrackView";
import { distinctPair, teamColor } from "@/lib/color";
import { fetchCircuit, fetchCircuitIndex } from "@/lib/circuits";
import { buildDeltaProfile, deltaAt } from "@/lib/telemetry/delta";
import { TelemetryPlayer } from "@/lib/telemetry/player";
import { sampleLap } from "@/lib/telemetry/sample";
import type { BakedCircuit } from "@/lib/track/geometry";
import type { BakedLap, DriverInfo, SessionInfo } from "@/lib/telemetry/types";

const YEARS = [2023, 2024, 2025];

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
  const [year, setYear] = useState(2024);
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

  // sessions for the year
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

  // drivers for the session
  useEffect(() => {
    setDrivers([]);
    setNumA(null);
    setNumB(null);
    setLaps(null);
    if (!sessionKey) return;
    getJson<DriverInfo[]>(`/api/drivers?session_key=${sessionKey}`).then(setDrivers).catch((e) => setError(String(e)));
  }, [sessionKey]);

  // load both fastest laps + circuit geometry
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
  const [colorA, colorB] = distinctPair(teamColor(driverA?.team_colour ?? null), teamColor(driverB?.team_colour ?? null, "#ff2d78"));

  const select = "rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-fog-100 outline-none focus-visible:border-fog-500";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Ghost lab</h1>
      <p className="mt-1.5 text-[13px] text-fog-500">Two fastest laps, head to head. Pick a session and two drivers.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select className={select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select className={select} value={meetingKey ?? ""} onChange={(e) => { setMeetingKey(Number(e.target.value)); setSessionKey(null); }}>
          <option value="" disabled>Grand Prix…</option>
          {meetings.map((m) => (
            <option key={m.meeting_key} value={m.meeting_key}>{m.circuit_short_name} · {m.country_name}</option>
          ))}
        </select>
        <select className={select} value={sessionKey ?? ""} onChange={(e) => setSessionKey(Number(e.target.value))} disabled={!meetingKey}>
          <option value="" disabled>Session…</option>
          {meetingSessions.map((s) => (
            <option key={s.session_key} value={s.session_key}>{s.session_name}</option>
          ))}
        </select>
        <select className={select} value={numA ?? ""} onChange={(e) => setNumA(Number(e.target.value))} disabled={drivers.length === 0}>
          <option value="" disabled>Driver A…</option>
          {drivers.map((d) => (
            <option key={d.driver_number} value={d.driver_number} disabled={d.driver_number === numB}>
              {d.name_acronym} — {d.team_name}
            </option>
          ))}
        </select>
        <select className={select} value={numB ?? ""} onChange={(e) => setNumB(Number(e.target.value))} disabled={drivers.length === 0}>
          <option value="" disabled>Driver B…</option>
          {drivers.map((d) => (
            <option key={d.driver_number} value={d.driver_number} disabled={d.driver_number === numA}>
              {d.name_acronym} — {d.team_name}
            </option>
          ))}
        </select>
        {loading && <span className="text-[13px] text-fog-500">Baking laps…</span>}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-3.5 py-2.5 text-[13px] text-neon-magenta">{error}</div>
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
        gapRef.current.style.color = gap > 0.005 ? colorB : gap < -0.005 ? colorA : "#eceaf6";
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

  const chip = (color: string, d: DriverInfo, lap: BakedLap) => (
    <div className="flex items-center gap-2.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[13px] font-semibold">{d.name_acronym}</span>
      <span className="text-[12px] text-fog-500">{d.team_name}</span>
      <span className="ml-auto font-mono text-[13px] text-fog-100">{fmtLap(lap.lapDuration)}</span>
    </div>
  );

  return (
    <div className="mt-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="aspect-[4/3] overflow-hidden rounded-xl border border-ink-600/60 bg-ink-900">
          <TrackView circuit={circuit} ghosts={ghosts} player={player} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-ink-600/60 bg-ink-900 p-5">
            <div className="text-[11px] tracking-[0.2em] text-fog-500">GAP AT CAR {driverA.name_acronym}</div>
            <div className="mt-1 font-mono text-5xl font-bold tabular-nums">
              <span ref={gapRef}>+0.000</span>
              <span className="ml-1 text-lg text-fog-500">s</span>
            </div>
            <div className="mt-4 space-y-2.5">
              {chip(colorA, driverA, lapA)}
              {chip(colorB, driverB, lapB)}
            </div>
          </div>

          <div className="rounded-xl border border-ink-600/60 bg-ink-900 p-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => player.toggle()}
                className="rounded-lg bg-neon-cyan px-4 py-2 text-[13px] font-bold text-ink-950 transition-opacity hover:opacity-85"
              >
                {playing ? "Pause" : "Play"}
              </button>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => { player.setSpeed(s); setSpeedState(s); }}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${speed === s ? "bg-ink-600 text-fog-100" : "text-fog-500 hover:text-fog-100"}`}
                >
                  {s}×
                </button>
              ))}
              <span ref={clockRef} className="ml-auto font-mono text-[13px] text-fog-300">0:00.000</span>
            </div>
            <input
              ref={scrubRef}
              type="range"
              min={0}
              max={player.duration}
              step={0.01}
              defaultValue={0}
              onInput={(e) => player.seek(Number(e.currentTarget.value))}
              className="mt-4 w-full accent-neon-cyan"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ink-600/60 bg-ink-900 px-4 pb-2 pt-1">
        <GhostCharts
          lapA={lapA}
          lapB={lapB}
          colorA={colorA}
          colorB={colorB}
          labelA={driverA.name_acronym}
          labelB={driverB.name_acronym}
          player={player}
        />
      </div>
    </div>
  );
}
