"use client";

import { useEffect, useMemo, useState } from "react";
import { CardsSkeleton, LoadingLine } from "@/components/ui/Loading";
import { PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { getDb } from "@/lib/db/duckdb";
import { seasonMatrix, teammateH2H, type H2HPair, type SeasonMatrix } from "@/lib/db/queries";

const A = "#2de2e6";
const B = "#ff2d78";
const YEARS = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i);
const YEAR_OPTIONS = YEARS.map((y) => ({ value: String(y), label: String(y) }));

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
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="04" title="The Numbers" sub="Every season since 1950, queried in your browser. No server involved." />

      <div className="mt-6 flex gap-0 border-b border-ink-700/70">
        {(
          [
            ["h2h", "Teammate H2H"],
            ["whatif", "What-if title fight"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative px-4 py-3 text-[13px] tracking-wide transition-colors ${
              tab === id ? "text-fog-100" : "text-fog-500 hover:text-fog-300"
            }`}
          >
            {label}
            {tab === id && <span className="absolute inset-x-4 -bottom-px h-[2px] bg-neon-cyan" />}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-3 text-[13px] text-neon-magenta">{error}</div>
      )}
      {!ready && !error && (
        <div className="mt-8">
          <LoadingLine>{progress}</LoadingLine>
          <CardsSkeleton count={4} className="mt-5" />
        </div>
      )}

      {ready && (tab === "h2h" ? <H2HTab /> : <WhatIfTab />)}
    </main>
  );
}

/* ---------------- Teammate H2H ---------------- */

function SplitBar({ a, b }: { a: number; b: number }) {
  const total = a + b || 1;
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-right font-mono text-[13px] tabular-nums" style={{ color: A }}>{a}</span>
      <div className="flex h-[6px] flex-1 gap-[2px] bg-ink-700">
        <div style={{ width: `${(a / total) * 100}%`, backgroundColor: A }} />
        <div style={{ width: `${(b / total) * 100}%`, backgroundColor: B }} />
      </div>
      <span className="w-12 font-mono text-[13px] tabular-nums" style={{ color: B }}>{b}</span>
    </div>
  );
}

function H2HTab() {
  const [year, setYear] = useState(2025);
  const [pairs, setPairs] = useState<H2HPair[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPairs(null);
    teammateH2H(year).then(setPairs).catch((e) => setError(String(e)));
  }, [year]);

  return (
    <div className="mt-6">
      <Select label="SEASON" className="w-36" value={String(year)} onValueChange={(v) => setYear(Number(v))} options={YEAR_OPTIONS} />
      {error && <div className="mt-4 text-[13px] text-neon-magenta">{error}</div>}
      {!pairs && !error && <CardsSkeleton count={6} className="mt-5" />}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {pairs?.map((p) => (
          <Panel key={`${p.constructorId}-${p.driverA}-${p.driverB}`} className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel>{p.constructorName.toUpperCase()}</SectionLabel>
              <span className="shrink-0 font-mono text-[10px] text-fog-500">{p.rounds} ROUNDS</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-semibold" style={{ color: A }}>{p.nameA}</span>
              <span className="shrink-0 text-[11px] text-fog-500">vs</span>
              <span className="truncate text-right text-[15px] font-semibold" style={{ color: B }}>{p.nameB}</span>
            </div>
            <div className="mt-4 space-y-3">
              {(
                [
                  ["QUALIFYING", p.qualiA, p.qualiB],
                  ["RACE FINISHES", p.raceA, p.raceB],
                  ["POINTS", p.pointsA, p.pointsB],
                ] as const
              ).map(([label, a, b]) => (
                <div key={label}>
                  <div className="mb-1 text-[10px] tracking-[0.18em] text-fog-500">{label}</div>
                  <SplitBar a={a} b={b} />
                </div>
              ))}
            </div>
          </Panel>
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

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="SEASON" className="w-32" value={String(year)} onValueChange={(v) => setYear(Number(v))} options={YEAR_OPTIONS} />
        {matrix && (
          <>
            <Select
              label="DNF A DRIVER"
              className="w-48"
              value={dnfDriver || null}
              onValueChange={setDnfDriver}
              placeholder="Driver…"
              options={matrix.drivers.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Select
              label="IN ROUND"
              className="w-48"
              value={dnfRound ? String(dnfRound) : null}
              onValueChange={(v) => setDnfRound(Number(v))}
              placeholder="Round…"
              disabled={!dnfDriver}
              options={matrix.rounds.map((r) => ({ value: String(r.round), label: pretty(r.name), hint: `R${r.round}` }))}
            />
            <button
              disabled={!dnfDriver || !dnfRound}
              onClick={() => {
                setDnfs((prev) => [...prev, { driverId: dnfDriver, round: dnfRound }]);
                setDnfDriver("");
                setDnfRound(0);
              }}
              className="chamfer h-10 bg-neon-cyan px-4 text-[13px] font-bold text-ink-950 transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              Add DNF
            </button>
            {modified && (
              <button
                onClick={() => {
                  setExcluded(new Set());
                  setDnfs([]);
                }}
                className="h-10 border border-ink-600 px-4 text-[13px] text-fog-300 transition-colors hover:text-fog-100"
              >
                Reset
              </button>
            )}
          </>
        )}
      </div>

      {error && <div className="mt-4 text-[13px] text-neon-magenta">{error}</div>}
      {!matrix && !error && <CardsSkeleton count={2} className="mt-6" />}

      {matrix && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <SectionLabel>ROUNDS — CLICK TO CANCEL A RACE</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {matrix.rounds.map((r) => {
                const off = excluded.has(r.round);
                return (
                  <button
                    key={r.round}
                    onClick={() => toggleRound(r.round)}
                    title={pretty(r.name)}
                    className={`border px-2.5 py-1.5 text-[12px] transition-colors ${
                      off
                        ? "border-neon-magenta/50 bg-neon-magenta/10 text-neon-magenta line-through"
                        : "border-ink-600 bg-ink-800 text-fog-300 hover:text-fog-100"
                    }`}
                  >
                    <span className="mr-1.5 font-mono text-[10px] text-fog-500">R{r.round}</span>
                    {pretty(r.name)}
                  </button>
                );
              })}
            </div>

            {dnfs.length > 0 && (
              <div className="mt-6">
                <SectionLabel accent="#ffb02e">INJECTED DNFS</SectionLabel>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dnfs.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setDnfs((prev) => prev.filter((_, j) => j !== i))}
                      className="border border-neon-amber/50 bg-neon-amber/10 px-2.5 py-1.5 text-[12px] text-neon-amber"
                    >
                      {matrix.drivers.find((x) => x.id === d.driverId)?.name} — R{d.round} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Panel>
            <div className="flex items-baseline justify-between border-b border-ink-700/70 px-4 py-3">
              <SectionLabel accent={modified ? "#ffb02e" : "#2de2e6"}>
                {modified ? "WHAT-IF STANDINGS" : "FINAL STANDINGS"}
              </SectionLabel>
              {modified && <span className="font-mono text-[10px] text-neon-amber">MODIFIED</span>}
            </div>
            {standings.slice(0, 12).map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 border-b border-ink-700/40 px-4 py-2 text-[13px] last:border-b-0 ${
                  s.pos === 1 ? "bg-ink-800/70" : ""
                }`}
              >
                <span className="w-5 font-mono text-[11px] tabular-nums text-fog-500">{s.pos}</span>
                <span className={`truncate ${s.pos === 1 ? "font-bold" : ""}`}>{s.name}</span>
                {s.pos === 1 && <span className="shrink-0 text-[9px] tracking-[0.2em] text-neon-amber">CHAMPION</span>}
                <span className="ml-auto font-mono tabular-nums">{s.pts}</span>
                <span
                  className={`w-8 text-right font-mono text-[11px] tabular-nums ${
                    s.delta > 0 ? "text-neon-green" : s.delta < 0 ? "text-neon-magenta" : "text-fog-500"
                  }`}
                >
                  {s.delta > 0 ? `▲${s.delta}` : s.delta < 0 ? `▼${-s.delta}` : "·"}
                </span>
              </div>
            ))}
            <div className="px-4 py-3 text-[11px] leading-relaxed text-fog-500">
              Points only — championship countback (win counts) not modelled; ties keep original standings order.
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
