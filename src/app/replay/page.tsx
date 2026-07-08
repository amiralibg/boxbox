"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GapChart } from "@/components/replay/GapChart";
import { ReplayTrack } from "@/components/replay/ReplayTrack";
import { teamColor } from "@/lib/color";
import { fetchCircuit, fetchCircuitIndex } from "@/lib/circuits";
import { TelemetryPlayer } from "@/lib/telemetry/player";
import { gapAt, orderAt, type ReplayBlob } from "@/lib/replay/types";
import type { BakedCircuit } from "@/lib/track/geometry";
import type { SessionInfo } from "@/lib/telemetry/types";

const YEARS = [2023, 2024, 2025];
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
  const [year, setYear] = useState(2024);
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

  const select = "rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-fog-100 outline-none focus-visible:border-fog-500";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Replay</h1>
      <p className="mt-1.5 text-[13px] text-fog-500">Whole session, every car. First load of a session bakes it (~1 min); after that it's instant.</p>

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
        {loading && <span className="animate-pulse text-[13px] text-neon-cyan">Baking session… first time takes a minute</span>}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-3.5 py-2.5 text-[13px] text-neon-magenta">{error}</div>
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

  const colors = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of blob.drivers) m.set(d.num, teamColor(d.colour));
    return m;
  }, [blob]);

  // second driver of each team gets a dashed line in the gap chart
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
      // leaderboard at ~4Hz of wall time is plenty
      if (Math.abs(t - lastBoard) < 2 && player.playing) return;
      lastBoard = t;
      const order = orderAt(blob.order, t);
      const board = blob.drivers
        .map((d) => ({ num: d.num, pos: order.get(d.num) ?? 99, gap: blob.gaps[d.num] ? gapAt(blob.gaps[d.num], blob.gapHz, t) : null }))
        .sort((a, b) => a.pos - b.pos);
      setRows(board);
    });
    player.seek(60); // skip the empty pre-formation minutes? no — start at t=60s into the session
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

  return (
    <div className="mt-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-ink-600/60 bg-ink-900">
            <ReplayTrack circuit={circuit} blob={blob} colors={colors} player={player} highlight={highlight} />
          </div>

          <div className="mt-4 rounded-xl border border-ink-600/60 bg-ink-900 p-4">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => player.toggle()}
                className="rounded-lg bg-neon-cyan px-4 py-2 text-[13px] font-bold text-ink-950 transition-opacity hover:opacity-85"
              >
                {playing ? "Pause" : "Play"}
              </button>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => { player.setSpeed(s); setSpeedState(s); }}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${speed === s ? "bg-ink-600 text-fog-100" : "text-fog-500 hover:text-fog-100"}`}
                >
                  {s}×
                </button>
              ))}
              <span className="ml-auto text-[11px] tracking-[0.15em] text-fog-500">SESSION CLOCK</span>
              <span ref={clockRef} className="font-mono text-[13px] text-fog-100">0:00:00</span>
            </div>
            <input
              ref={scrubRef}
              type="range"
              min={0}
              max={blob.duration}
              step={1}
              defaultValue={0}
              onInput={(e) => player.seek(Number(e.currentTarget.value))}
              className="mt-3 w-full accent-neon-cyan"
            />
          </div>
        </div>

        <div className="max-h-[640px] overflow-y-auto rounded-xl border border-ink-600/60 bg-ink-900">
          <div className="sticky top-0 border-b border-ink-700/60 bg-ink-900 px-4 py-2.5 text-[11px] tracking-[0.2em] text-fog-500">
            RUNNING ORDER
          </div>
          {rows.map((r) => {
            const d = byNum.get(r.num);
            if (!d || r.pos === 99) return null;
            const active = highlight.has(r.num);
            return (
              <button
                key={r.num}
                onClick={() => toggleHl(r.num)}
                className={`flex w-full items-center gap-2.5 border-b border-ink-700/40 px-4 py-2 text-left text-[13px] transition-colors last:border-b-0 ${
                  active ? "bg-ink-700/70" : "hover:bg-ink-800"
                }`}
              >
                <span className="w-6 shrink-0 font-mono text-[11px] text-fog-500">{r.pos}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(r.num) }} />
                <span className="font-semibold">{d.acronym}</span>
                <span className="ml-auto font-mono text-[12px] text-fog-300">
                  {r.pos === 1 ? "LEADER" : r.gap != null ? `+${r.gap.toFixed(1)}` : "—"}
                </span>
              </button>
            );
          })}
          {rows.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-fog-500">Scrub into the session…</div>}
        </div>
      </div>

      {Object.keys(blob.gaps).length > 0 && (
        <div className="mt-6 rounded-xl border border-ink-600/60 bg-ink-900 px-4 pb-3 pt-3">
          <div className="px-1 pb-2 text-[11px] tracking-[0.18em] text-fog-500">GAP TO LEADER</div>
          <GapChart blob={blob} colors={colors} dashed={dashed} player={player} highlight={highlight} />
        </div>
      )}
    </div>
  );
}
