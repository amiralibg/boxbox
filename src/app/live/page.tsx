"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveTrack } from "@/components/live/LiveTrack";
import { LivePlayback } from "@/lib/live/playback";
import { StageSkeleton } from "@/components/ui/Loading";
import { EmptyState, PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { teamColor } from "@/lib/color";
import { useTheme } from "@/lib/theme";
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
  const bufRef = useRef<HTMLSpanElement>(null);
  /** session-seconds one poll covers — the buffer readout goes red below this */
  const pollSRef = useRef(4);
  const playback = useRef<LivePlayback | null>(null);
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
    setMeta(null);
    setCircuit(null);
    setOrder([]);
    setError(null);
    setStatus("connecting");

    // clock trails the newest data by ~2.75 poll windows of session time —
    // deep enough that one slow uncached poll doesn't drain the buffer and
    // freeze the field
    const pollMs = simulate ? Math.max(1000, 4000 / speed) : 4000;
    const lagS = 2.75 * (pollMs / 1000) * (simulate ? speed : 1);
    pollSRef.current = (pollMs / 1000) * (simulate ? speed : 1);
    playback.current = new LivePlayback(simulate ? speed : 1, lagS);
    const url = `/api/live/${sessionKey}${simulate ? `?simulate=1&speed=${speed}` : ""}`;
    const es = new EventSource(url);
    esRef.current = es;

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
      playback.current?.addFrame(JSON.parse((e as MessageEvent).data) as LiveFrame);
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

  // leaderboard + clock tick: apply timed order/gap events as playback reaches them
  useEffect(() => {
    if (status !== "live") return;
    const posMap = new Map<number, number>();
    const gapMap = new Map<number, number | null>();
    const tick = () => {
      const pb = playback.current;
      if (!pb || !pb.hasData) return;
      const t = pb.now();
      if (clockRef.current) clockRef.current.textContent = fmtClock(t);
      if (bufRef.current) {
        const buf = pb.bufferS;
        bufRef.current.textContent = `BUF ${buf.toFixed(1)}S`;
        bufRef.current.style.color = buf < pollSRef.current ? "var(--color-red)" : "";
      }
      const events = pb.drainEvents(t);
      if (events.length === 0) return;
      for (const e of events) {
        if (e.order) for (const o of e.order) posMap.set(o.num, o.pos);
        if (e.gaps) for (const [num, gap] of Object.entries(e.gaps)) gapMap.set(Number(num), gap);
      }
      setOrder(
        [...posMap]
          .map(([num, pos]) => ({ num, pos, gap: gapMap.get(num) ?? null }))
          .sort((a, b) => a.pos - b.pos),
      );
    };
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [status]);

  const theme = useTheme();
  const colors = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of meta?.drivers ?? []) m.set(d.num, teamColor(d.colour, theme));
    return m;
  }, [meta, theme]);

  const byNum = useMemo(() => new Map((meta?.drivers ?? []).map((d) => [d.num, d])), [meta]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="06" title="Live" sub="Free-tier delayed feed, near-live. Simulation replays a finished session through the identical pipeline." />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Select
          label="SESSION"
          className="w-full sm:w-72"
          value={sessionKey ? String(sessionKey) : null}
          onValueChange={(v) => setSessionKey(Number(v))}
          options={sessions.slice(0, 40).map((s) => ({
            value: String(s.session_key),
            label: `${s.circuit_short_name} · ${s.session_name}`,
            hint: s.date_start.slice(0, 10),
          }))}
        />
        <label className="flex h-10 cursor-pointer items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} className="box" />
          Simulate
        </label>
        {simulate && (
          <Select
            label="CLOCK"
            className="w-28"
            value={String(speed)}
            onValueChange={(v) => setSpeed(Number(v))}
            options={[1, 10, 30, 60].map((s) => ({ value: String(s), label: `${s}×` }))}
          />
        )}
        <button
          onClick={connect}
          disabled={!sessionKey || status === "connecting"}
          className="h-10 bg-ink px-5 text-[13px] font-semibold text-paper transition-colors hover:bg-red disabled:opacity-40"
        >
          {status === "connecting" ? "Connecting…" : status === "live" ? "Reconnect" : "Connect"}
        </button>
        <span className="flex h-10 items-center gap-2 text-[13px] text-ink-3 md:ml-auto">
          {status === "live" && <span className="h-2 w-2 animate-pulse rounded-full bg-red" />}
          {status === "ended" && <span className="h-2 w-2 rounded-full bg-ink-3" />}
          {status === "live" ? "LIVE" : status === "ended" ? "SESSION ENDED" : status.toUpperCase()}
          <span ref={clockRef} className="font-mono text-ink">—</span>
          {status === "live" && <span ref={bufRef} className="font-mono text-[11px] text-ink-3" />}
        </span>
      </div>

      {error && (
        <div className="mt-4 border border-red/30 bg-red/5 px-4 py-3 text-[13px] text-red-deep">{error}</div>
      )}

      {status === "connecting" && <StageSkeleton label="CONNECTING FEED" note="SSE" sidebarRows={10} />}

      {status === "idle" && !error && (
        <EmptyState
          title="Feed not connected"
          hint="Pick a session and hit Connect. Simulate replays a finished session as if it were live — crank the clock to fast-forward."
        />
      )}

      {meta && circuit && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Panel className="min-w-0 overflow-hidden">
            <div className="px-4 pt-4">
              <SectionLabel accent="var(--color-green)">{meta.sessionName.toUpperCase()} — DELAYED REST FEED</SectionLabel>
            </div>
            <div className="aspect-[4/3]">
              <LiveTrack circuit={circuit} meta={meta} colors={colors} playback={playback} />
            </div>
          </Panel>
          <Panel className="panel-scroll max-h-[640px] overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-ink/15 bg-paper px-4 py-3">
              <SectionLabel accent="var(--color-green)">RUNNING ORDER</SectionLabel>
            </div>
            {order.map((r) => {
              const d = byNum.get(r.num);
              if (!d) return null;
              return (
                <div key={r.num} className="flex items-center gap-2.5 border-b border-ink/10 px-4 py-[7px] text-[13px] last:border-b-0">
                  <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-ink-3">{r.pos}</span>
                  <span className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: colors.get(r.num) }} />
                  <span className="font-semibold">{d.acronym}</span>
                  <span className="ml-auto font-mono text-[12px] text-ink-2">
                    {r.pos === 1 ? "LEADER" : r.gap != null ? `+${r.gap.toFixed(1)}` : "—"}
                  </span>
                </div>
              );
            })}
            {order.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-ink-3">Waiting for timing data…</div>}
          </Panel>
        </div>
      )}
    </main>
  );
}
