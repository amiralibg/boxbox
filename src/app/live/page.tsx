"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveTrack, type CarTween } from "@/components/live/LiveTrack";
import { teamColor } from "@/lib/color";
import { fetchCircuit, fetchCircuitIndex } from "@/lib/circuits";
import type { BakedCircuit } from "@/lib/track/geometry";
import type { LiveFrame, LiveMeta } from "@/lib/live/types";
import type { SessionInfo } from "@/lib/telemetry/types";

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

type Status = "idle" | "connecting" | "live" | "ended" | "error";

export default function LivePage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [simulate, setSimulate] = useState(true);
  const [speed, setSpeed] = useState(30);
  const [status, setStatus] = useState<Status>("idle");
  const [meta, setMeta] = useState<LiveMeta | null>(null);
  const [circuit, setCircuit] = useState<BakedCircuit | null>(null);
  const [order, setOrder] = useState<{ num: number; pos: number; gap: number | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const tweens = useRef(new Map<number, CarTween>());
  const esRef = useRef<EventSource | null>(null);

  // latest sessions of the current year, newest first
  useEffect(() => {
    const load = (year: number) =>
      getJson<SessionInfo[]>(`/api/sessions?year=${year}`).then((all) => {
        // only sessions that have already started — the calendar includes the future
        const started = all
          .filter((s) => Date.parse(s.date_start) <= Date.now())
          .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start));
        if (started.length === 0) throw new Error("no started sessions");
        setSessions(started);
        setSessionKey(started[0].session_key);
      });
    load(new Date().getFullYear()).catch(() =>
      load(new Date().getFullYear() - 1).catch((e) => setError(String(e))),
    );
  }, []);

  const connect = () => {
    if (!sessionKey) return;
    esRef.current?.close();
    tweens.current.clear();
    setMeta(null);
    setCircuit(null);
    setOrder([]);
    setError(null);
    setStatus("connecting");

    const pollMs = simulate ? Math.max(1000, 4000 / speed) : 4000;
    const url = `/api/live/${sessionKey}${simulate ? `?simulate=1&speed=${speed}` : ""}`;
    const es = new EventSource(url);
    esRef.current = es;

    const gapsRef = new Map<number, number | null>();
    const posRef = new Map<number, number>();

    es.addEventListener("meta", async (e) => {
      const m = JSON.parse((e as MessageEvent).data) as LiveMeta;
      setMeta(m);
      try {
        const index = await fetchCircuitIndex();
        const entry = index.find((c) => c.circuitKey === m.circuitKey);
        if (!entry) throw new Error(`no baked geometry for circuit ${m.circuitKey}`);
        setCircuit(await fetchCircuit(entry.slug));
        setStatus("live");
      } catch (err) {
        setError(String(err));
        setStatus("error");
        es.close();
      }
    });

    es.addEventListener("frame", (e) => {
      const frame = JSON.parse((e as MessageEvent).data) as LiveFrame;
      const now = performance.now();
      for (const [numStr, car] of Object.entries(frame.cars)) {
        const num = Number(numStr);
        const prev = tweens.current.get(num);
        const cur = prev
          ? {
              x: prev.fromX + (prev.toX - prev.fromX) * Math.min(1, (now - prev.at) / prev.over),
              y: prev.fromY + (prev.toY - prev.fromY) * Math.min(1, (now - prev.at) / prev.over),
            }
          : { x: car.x, y: car.y };
        tweens.current.set(num, { fromX: cur.x, fromY: cur.y, toX: car.x, toY: car.y, at: now, over: pollMs });
      }
      if (clockRef.current) clockRef.current.textContent = fmtClock(frame.t);
      if (frame.order) for (const o of frame.order) posRef.set(o.num, o.pos);
      if (frame.gaps) for (const [num, gap] of Object.entries(frame.gaps)) gapsRef.set(Number(num), gap);
      if (frame.order || frame.gaps) {
        setOrder(
          [...posRef]
            .map(([num, pos]) => ({ num, pos, gap: gapsRef.get(num) ?? null }))
            .sort((a, b) => a.pos - b.pos),
        );
      }
    });

    es.addEventListener("end", () => {
      setStatus("ended");
      es.close();
    });
    es.onerror = () => {
      setStatus((s) => (s === "live" ? "live" : "error")); // EventSource auto-reconnects while live
    };
  };

  useEffect(() => () => esRef.current?.close(), []);

  const colors = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of meta?.drivers ?? []) m.set(d.num, teamColor(d.colour));
    return m;
  }, [meta]);

  const byNum = useMemo(() => new Map((meta?.drivers ?? []).map((d) => [d.num, d])), [meta]);
  const select = "rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-fog-100 outline-none";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Live</h1>
      <p className="mt-1.5 text-[13px] text-fog-500">
        Free-tier delayed feed (~near-live). Simulation replays a finished session through the identical live pipeline.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select className={select} value={sessionKey ?? ""} onChange={(e) => setSessionKey(Number(e.target.value))}>
          {sessions.slice(0, 40).map((s) => (
            <option key={s.session_key} value={s.session_key}>
              {s.circuit_short_name} · {s.session_name} · {s.date_start.slice(0, 10)}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fog-300">
          <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} className="h-4 w-4 accent-neon-cyan" />
          Simulate
        </label>
        {simulate && (
          <select className={select} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {[1, 10, 30, 60].map((s) => (
              <option key={s} value={s}>{s}× clock</option>
            ))}
          </select>
        )}
        <button
          onClick={connect}
          disabled={!sessionKey || status === "connecting"}
          className="rounded-lg bg-neon-cyan px-4 py-2 text-[13px] font-bold text-ink-950 transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {status === "connecting" ? "Connecting…" : status === "live" ? "Reconnect" : "Connect"}
        </button>
        <span className="ml-auto flex items-center gap-2 text-[13px] text-fog-500">
          {status === "live" && <span className="h-2 w-2 animate-pulse rounded-full bg-neon-green" />}
          {status === "ended" && <span className="h-2 w-2 rounded-full bg-fog-500" />}
          {status === "live" ? "LIVE" : status === "ended" ? "SESSION ENDED" : status.toUpperCase()}
          <span ref={clockRef} className="font-mono text-fog-100">—</span>
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-3.5 py-2.5 text-[13px] text-neon-magenta">{error}</div>
      )}

      {meta && circuit && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-ink-600/60 bg-ink-900">
            <LiveTrack circuit={circuit} meta={meta} colors={colors} tweens={tweens} />
          </div>
          <div className="max-h-[640px] overflow-y-auto rounded-xl border border-ink-600/60 bg-ink-900">
            <div className="sticky top-0 border-b border-ink-700/60 bg-ink-900 px-4 py-2.5 text-[11px] tracking-[0.2em] text-fog-500">
              RUNNING ORDER
            </div>
            {order.map((r) => {
              const d = byNum.get(r.num);
              if (!d) return null;
              return (
                <div key={r.num} className="flex items-center gap-2.5 border-b border-ink-700/40 px-4 py-2 text-[13px] last:border-b-0">
                  <span className="w-6 shrink-0 font-mono text-[11px] text-fog-500">{r.pos}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(r.num) }} />
                  <span className="font-semibold">{d.acronym}</span>
                  <span className="ml-auto font-mono text-[12px] text-fog-300">
                    {r.pos === 1 ? "LEADER" : r.gap != null ? `+${r.gap.toFixed(1)}` : "—"}
                  </span>
                </div>
              );
            })}
            {order.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-fog-500">Waiting for timing data…</div>}
          </div>
        </div>
      )}
    </main>
  );
}
