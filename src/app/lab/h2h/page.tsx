"use client";

import { useEffect, useMemo, useState } from "react";
import { CardsSkeleton, LoadingLine } from "@/components/ui/Loading";
import { CapabilityNotice, PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { f1dbSeasonCatalog } from "@/lib/db/catalog";
import { getDb } from "@/lib/db/duckdb";
import { h2hRounds, technicalH2H, type H2HRound, type TechnicalH2HPair } from "@/lib/db/h2h";

const fmt = (value: number | null) => value == null ? "—" : value.toFixed(2);
const pretty = (value: string) => value.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");

function CompareBar({ a, b }: { a: number; b: number }) {
  const total = a + b || 1;
  return (
    <div className="grid grid-cols-[54px_1fr_54px] items-center gap-2 font-mono text-xs tabular-nums">
      <span className="text-right text-red">{a}</span>
      <div className="flex h-2 bg-paper-3"><span className="bg-red" style={{ width: `${a / total * 100}%` }} /><span className="bg-blue" style={{ width: `${b / total * 100}%` }} /></div>
      <span className="text-blue">{b}</span>
    </div>
  );
}

export default function H2HPage() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState("STARTING DUCKDB");
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [pairs, setPairs] = useState<TechnicalH2HPair[]>([]);
  const [pairKey, setPairKey] = useState("");
  const [rounds, setRounds] = useState<H2HRound[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb(setProgress)
      .then(async () => {
        const catalog = await f1dbSeasonCatalog();
        const next = catalog.filter((entry) => entry.capabilities.has("h2h")).map((entry) => entry.year);
        setYears(next);
        setYear(next[0] ?? null);
        setReady(true);
      })
      .catch((reason) => setError(String(reason)));
  }, []);

  useEffect(() => {
    if (!ready || year == null) return;
    setPairs([]);
    setPairKey("");
    setRounds([]);
    technicalH2H(year).then((next) => {
      setPairs(next);
      if (next[0]) setPairKey(`${next[0].constructorId}|${next[0].driverA}|${next[0].driverB}`);
    }).catch((reason) => setError(String(reason)));
  }, [ready, year]);

  const pair = useMemo(() => pairs.find((item) => `${item.constructorId}|${item.driverA}|${item.driverB}` === pairKey) ?? null, [pairs, pairKey]);
  useEffect(() => {
    if (!pair || year == null) return;
    h2hRounds(year, pair).then(setRounds).catch((reason) => setError(String(reason)));
  }, [pair, year]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="LAB / HISTORY.03" title="Head to head" sub="Teammate-only comparison over shared constructor rounds. F1DB is queried locally; no cross-team pace claims." />
      <div className="mt-5"><CapabilityNotice source="F1DB">Results begin in 1950. Sprint metrics appear from 2021. Sample size and missing classifications remain visible.</CapabilityNotice></div>
      {error && <div className="mt-4 border border-red/30 bg-red/5 p-3 font-mono text-[10px] text-red">{error}</div>}
      {!ready && !error && <div className="mt-8"><LoadingLine>{progress}</LoadingLine><CardsSkeleton count={3} className="mt-4" /></div>}
      {ready && year != null && (
        <>
          <Panel className="mt-5 p-4">
            <div className="grid gap-3 md:grid-cols-[140px_minmax(0,460px)]">
              <Select label="SEASON" value={String(year)} onValueChange={(value) => setYear(Number(value))} options={years.map((item) => ({ value: String(item), label: String(item) }))} />
              <Select label="TEAM / DRIVER PAIR" value={pairKey || null} onValueChange={setPairKey} options={pairs.map((item) => ({ value: `${item.constructorId}|${item.driverA}|${item.driverB}`, label: `${item.nameA} / ${item.nameB}`, hint: item.constructorName.toUpperCase() }))} />
            </div>
          </Panel>
          {pair && (
            <>
              <div className="mt-5 grid gap-px border border-ink/15 bg-ink/15 lg:grid-cols-[1fr_1fr_1fr]">
                <Panel className="border-0 p-5">
                  <SectionLabel>{pair.constructorName.toUpperCase()} · {pair.rounds} SHARED ROUNDS</SectionLabel>
                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-4"><strong className="text-lg text-red">{pair.nameA}</strong><span className="font-mono text-[9px] text-ink-3">VERSUS</span><strong className="text-right text-lg text-blue">{pair.nameB}</strong></div>
                  <div className="mt-6 space-y-4">
                    {[["QUALIFYING", pair.qualiA, pair.qualiB], ["RACE FINISH", pair.raceA, pair.raceB], ["SPRINT", pair.sprintA, pair.sprintB], ["SHARED-ROUND POINTS", pair.pointsA, pair.pointsB]].map(([label, a, b]) => <div key={String(label)}><div className="mb-1 font-mono text-[9px] text-ink-3">{label}</div><CompareBar a={Number(a)} b={Number(b)} /></div>)}
                  </div>
                </Panel>
                <Panel className="border-0 p-5">
                  <SectionLabel>POSITION AVERAGES</SectionLabel>
                  <dl className="mt-5 space-y-4 font-mono text-xs">
                    {[["AVG GRID", pair.avgGridA, pair.avgGridB], ["AVG FINISH", pair.avgFinishA, pair.avgFinishB], ["CLASSIFIED", pair.reliabilityA, pair.reliabilityB]].map(([label, a, b]) => (
                      <div key={String(label)} className="grid grid-cols-[1fr_100px_1fr] border-b border-ink/10 pb-3"><dd className="text-red">{typeof a === "number" ? fmt(a) : a}</dd><dt className="text-center text-[9px] text-ink-3">{label}</dt><dd className="text-right text-blue">{typeof b === "number" ? fmt(b) : b}</dd></div>
                    ))}
                  </dl>
                </Panel>
                <Panel className="border-0 p-5">
                  <SectionLabel>METHODOLOGY</SectionLabel>
                  <ul className="mt-5 space-y-3 font-mono text-[10px] leading-4 text-ink-2">
                    <li>Only rounds where both drivers entered for the same constructor are compared.</li>
                    <li>Points are restricted to those shared rounds, including sprint points.</li>
                    <li>Unclassified finishes remain in reliability counts and do not become artificial H2H wins.</li>
                    <li>Minimum sample: three shared rounds.</li>
                  </ul>
                </Panel>
              </div>
              <Panel className="mt-5 overflow-hidden">
                <div className="border-b border-ink/15 px-4 py-3"><SectionLabel>ROUND LOG · RAW COMPARABLE RESULTS</SectionLabel></div>
                <div className="panel-scroll overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse font-mono text-[10px]">
                    <thead className="bg-paper-2 text-ink-3"><tr>{["RD","RACE","QA","QB","GRID A","GRID B","FIN A","FIN B","PTS A","PTS B","GAIN A","GAIN B"].map((label) => <th key={label} className="border-b border-ink/15 px-3 py-2 text-right first:text-left nth-[2]:text-left">{label}</th>)}</tr></thead>
                    <tbody>{rounds.map((row) => <tr key={row.round} className="border-b border-ink/10 hover:bg-paper-2"><td className="px-3 py-2">{row.round}</td><td className="px-3 py-2">{pretty(row.race)}</td>{[row.qualiA,row.qualiB,row.gridA,row.gridB,row.finishA,row.finishB,row.pointsA,row.pointsB,row.gainedA,row.gainedB].map((value, index) => <td key={index} className="px-3 py-2 text-right tabular-nums">{value ?? "—"}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}
        </>
      )}
    </main>
  );
}
