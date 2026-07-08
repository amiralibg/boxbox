"use client";

import { useEffect, useMemo, useState } from "react";
import { getDb } from "@/lib/db/duckdb";
import { seasonMatrix, teammateH2H, type H2HPair, type SeasonMatrix } from "@/lib/db/queries";

const A = "#2de2e6";
const B = "#ff2d78";
const YEARS = Array.from({ length: 2025 - 1950 + 1 }, (_, i) => 2025 - i);

const pretty = (slug: string) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

export default function NumbersPage() {
  const [tab, setTab] = useState<"h2h" | "whatif">("h2h");
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState("Starting…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb(setProgress)
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-baseline gap-6">
        <h1 className="text-2xl font-bold tracking-tight">The Numbers</h1>
        <nav className="flex gap-1 rounded-lg border border-ink-600/60 bg-ink-900 p-1">
          {(
            [
              ["h2h", "Teammate H2H"],
              ["whatif", "What-if title fight"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3.5 py-1.5 text-[13px] transition-colors ${
                tab === id ? "bg-ink-600 text-fog-100" : "text-fog-500 hover:text-fog-100"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      <p className="mt-1.5 text-[13px] text-fog-500">
        Full 1950–now history, queried in your browser. No server involved.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-3.5 py-2.5 text-[13px] text-neon-magenta">{error}</div>
      )}
      {!ready && !error && (
        <div className="mt-10 flex items-center gap-3 text-[13px] text-fog-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-neon-cyan" />
          {progress}
        </div>
      )}

      {ready && (tab === "h2h" ? <H2HTab /> : <WhatIfTab />)}
    </main>
  );
}

/* ---------------- Teammate H2H ---------------- */

function SplitBar({ a, b, fmtA, fmtB }: { a: number; b: number; fmtA?: string; fmtB?: string }) {
  const total = a + b || 1;
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-right font-mono text-[13px] tabular-nums" style={{ color: A }}>{fmtA ?? a}</span>
      <div className="flex h-2 flex-1 gap-[2px] overflow-hidden rounded-full bg-ink-700">
        <div className="rounded-l-full" style={{ width: `${(a / total) * 100}%`, backgroundColor: A }} />
        <div className="rounded-r-full" style={{ width: `${(b / total) * 100}%`, backgroundColor: B }} />
      </div>
      <span className="w-12 font-mono text-[13px] tabular-nums" style={{ color: B }}>{fmtB ?? b}</span>
    </div>
  );
}

function H2HTab() {
  const [year, setYear] = useState(2024);
  const [pairs, setPairs] = useState<H2HPair[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPairs(null);
    teammateH2H(year).then(setPairs).catch((e) => setError(String(e)));
  }, [year]);

  return (
    <div className="mt-6">
      <select
        className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-fog-100 outline-none"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      {error && <div className="mt-4 text-[13px] text-neon-magenta">{error}</div>}
      {!pairs && !error && <div className="mt-6 text-[13px] text-fog-500">Crunching…</div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {pairs?.map((p) => (
          <div key={`${p.constructorId}-${p.driverA}-${p.driverB}`} className="rounded-xl border border-ink-600/60 bg-ink-900 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium tracking-[0.2em] text-fog-500">{p.constructorName.toUpperCase()}</span>
              <span className="text-[11px] text-fog-500">{p.rounds} rounds both classified</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-semibold" style={{ color: A }}>{p.nameA}</span>
              <span className="shrink-0 text-[11px] text-fog-500">vs</span>
              <span className="truncate text-right text-[15px] font-semibold" style={{ color: B }}>{p.nameB}</span>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 text-[10px] tracking-[0.18em] text-fog-500">QUALIFYING</div>
                <SplitBar a={p.qualiA} b={p.qualiB} />
              </div>
              <div>
                <div className="mb-1 text-[10px] tracking-[0.18em] text-fog-500">RACE FINISHES</div>
                <SplitBar a={p.raceA} b={p.raceB} />
              </div>
              <div>
                <div className="mb-1 text-[10px] tracking-[0.18em] text-fog-500">POINTS</div>
                <SplitBar a={p.pointsA} b={p.pointsB} fmtA={String(p.pointsA)} fmtB={String(p.pointsB)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- What-if calculator ---------------- */

interface Dnf {
  driverId: string;
  round: number;
}

function WhatIfTab() {
  const [year, setYear] = useState(2021);
  const [matrix, setMatrix] = useState<SeasonMatrix | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [dnfs, setDnfs] = useState<Dnf[]>([]);
  const [dnfDriver, setDnfDriver] = useState("");
  const [dnfRound, setDnfRound] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMatrix(null);
    setExcluded(new Set());
    setDnfs([]);
    seasonMatrix(year).then(setMatrix).catch((e) => setError(String(e)));
  }, [year]);

  const standings = useMemo(() => {
    if (!matrix) return [];
    const dnfSet = new Set(dnfs.map((d) => `${d.driverId}|${d.round}`));
    const totals = matrix.drivers.map((d) => {
      let pts = 0;
      const perRound = matrix.points[d.id] ?? {};
      for (const [roundStr, p] of Object.entries(perRound)) {
        const round = Number(roundStr);
        if (excluded.has(round)) continue;
        if (dnfSet.has(`${d.id}|${round}`)) continue;
        pts += p;
      }
      return { id: d.id, name: d.name, pts };
    });
    totals.sort((a, b) => b.pts - a.pts);
    const officialPos = new Map(matrix.official.map((o) => [o.driverId, o.position]));
    return totals.map((t, i) => ({ ...t, pos: i + 1, delta: (officialPos.get(t.id) ?? 99) - (i + 1) }));
  }, [matrix, excluded, dnfs]);

  const toggleRound = (round: number) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(round) ? next.delete(round) : next.add(round);
      return next;
    });

  const modified = excluded.size > 0 || dnfs.length > 0;
  const select = "rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-fog-100 outline-none";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <select className={select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {matrix && (
          <>
            <select className={select} value={dnfDriver} onChange={(e) => setDnfDriver(e.target.value)}>
              <option value="">DNF a driver…</option>
              {matrix.drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select className={select} value={dnfRound} onChange={(e) => setDnfRound(Number(e.target.value))} disabled={!dnfDriver}>
              <option value={0}>in round…</option>
              {matrix.rounds.map((r) => (
                <option key={r.round} value={r.round}>R{r.round} {pretty(r.name)}</option>
              ))}
            </select>
            <button
              disabled={!dnfDriver || !dnfRound}
              onClick={() => {
                setDnfs((prev) => [...prev, { driverId: dnfDriver, round: dnfRound }]);
                setDnfDriver("");
                setDnfRound(0);
              }}
              className="rounded-lg bg-neon-cyan px-3.5 py-2 text-[13px] font-bold text-ink-950 transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              Add DNF
            </button>
            {modified && (
              <button
                onClick={() => { setExcluded(new Set()); setDnfs([]); }}
                className="rounded-lg border border-ink-600 px-3.5 py-2 text-[13px] text-fog-300 transition-colors hover:text-fog-100"
              >
                Reset
              </button>
            )}
          </>
        )}
      </div>

      {error && <div className="mt-4 text-[13px] text-neon-magenta">{error}</div>}
      {!matrix && !error && <div className="mt-6 text-[13px] text-fog-500">Crunching…</div>}

      {matrix && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-2 text-[11px] tracking-[0.2em] text-fog-500">ROUNDS — CLICK TO CANCEL A RACE</div>
            <div className="flex flex-wrap gap-1.5">
              {matrix.rounds.map((r) => {
                const off = excluded.has(r.round);
                return (
                  <button
                    key={r.round}
                    onClick={() => toggleRound(r.round)}
                    title={pretty(r.name)}
                    className={`rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
                      off
                        ? "border-neon-magenta/50 bg-neon-magenta/10 text-neon-magenta line-through"
                        : "border-ink-600 bg-ink-800 text-fog-300 hover:text-fog-100"
                    }`}
                  >
                    R{r.round} {pretty(r.name)}
                  </button>
                );
              })}
            </div>

            {dnfs.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] tracking-[0.2em] text-fog-500">INJECTED DNFS</div>
                <div className="flex flex-wrap gap-1.5">
                  {dnfs.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setDnfs((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-md border border-neon-amber/50 bg-neon-amber/10 px-2.5 py-1.5 text-[12px] text-neon-amber"
                    >
                      {matrix.drivers.find((x) => x.id === d.driverId)?.name} — R{d.round} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-ink-600/60 bg-ink-900">
            <div className="flex items-baseline justify-between border-b border-ink-700/60 px-4 py-2.5">
              <span className="text-[11px] tracking-[0.2em] text-fog-500">{modified ? "WHAT-IF STANDINGS" : "FINAL STANDINGS"}</span>
              {modified && <span className="text-[11px] text-neon-amber">modified</span>}
            </div>
            {standings.slice(0, 12).map((s) => (
              <div key={s.id} className={`flex items-center gap-3 border-b border-ink-700/40 px-4 py-2 text-[13px] last:border-b-0 ${s.pos === 1 ? "bg-ink-800/60" : ""}`}>
                <span className="w-5 font-mono text-[11px] text-fog-500">{s.pos}</span>
                <span className={s.pos === 1 ? "font-bold" : ""}>{s.name}</span>
                {s.pos === 1 && <span className="text-[10px] tracking-widest text-neon-amber">CHAMPION</span>}
                <span className="ml-auto font-mono tabular-nums">{s.pts}</span>
                <span className={`w-8 text-right font-mono text-[11px] tabular-nums ${s.delta > 0 ? "text-neon-green" : s.delta < 0 ? "text-neon-magenta" : "text-fog-500"}`}>
                  {s.delta > 0 ? `▲${s.delta}` : s.delta < 0 ? `▼${-s.delta}` : "·"}
                </span>
              </div>
            ))}
            <div className="px-4 py-2 text-[11px] leading-relaxed text-fog-500">
              Points only — championship countback (win counts) not modelled; ties keep original standings order.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
