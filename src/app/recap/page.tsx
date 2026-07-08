"use client";

import { useEffect, useRef, useState } from "react";
import { RecapCard } from "@/components/recap/RecapCard";
import { getDb } from "@/lib/db/duckdb";
import { driverSeasonRecap, seasonDrivers, type RecapData } from "@/lib/db/queries";
import { downloadPng, downloadSvg } from "@/lib/export";

const YEARS = Array.from({ length: 2025 - 1950 + 1 }, (_, i) => 2025 - i);
const ACCENTS = [
  { name: "Cyan", value: "#2de2e6" },
  { name: "Magenta", value: "#ff2d78" },
  { name: "Violet", value: "#a06cff" },
  { name: "Amber", value: "#ffb02e" },
  { name: "Green", value: "#3ff5a0" },
];

export default function RecapPage() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState("Starting…");
  const [year, setYear] = useState(2024);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [driverId, setDriverId] = useState("max-verstappen");
  const [accent, setAccent] = useState(ACCENTS[0].value);
  const [data, setData] = useState<RecapData | null>(null);
  const [exporting, setExporting] = useState<"svg" | "png" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDb(setProgress).then(() => setReady(true)).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!ready) return;
    seasonDrivers(year)
      .then((d) => {
        setDrivers(d);
        if (!d.some((x) => x.id === driverId) && d.length > 0) setDriverId(d[0].id);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, year]);

  useEffect(() => {
    if (!ready || !driverId) return;
    let stale = false;
    setData(null);
    driverSeasonRecap(year, driverId)
      .then((d) => !stale && setData(d))
      .catch((e) => !stale && setError(String(e)));
    return () => {
      stale = true;
    };
  }, [ready, year, driverId]);

  async function onExport(kind: "svg" | "png") {
    const el = svgHost.current?.querySelector("svg");
    if (!el || !data) return;
    setExporting(kind);
    try {
      const name = `boxbox-recap-${data.driverId}-${data.year}`;
      if (kind === "svg") await downloadSvg(el, name);
      else await downloadPng(el, name, 2);
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(null);
    }
  }

  const select = "rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-fog-100 outline-none";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Recap</h1>
      <p className="mt-1.5 text-[13px] text-fog-500">Any driver, any season since 1950 — one shareable card.</p>

      {error && (
        <div className="mt-4 rounded-lg border border-neon-magenta/40 bg-neon-magenta/10 px-3.5 py-2.5 text-[13px] text-neon-magenta">{error}</div>
      )}
      {!ready && !error && (
        <div className="mt-10 flex items-center gap-3 text-[13px] text-fog-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-neon-cyan" />
          {progress}
        </div>
      )}

      {ready && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select className={select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select className={select} value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  title={a.name}
                  onClick={() => setAccent(a.value)}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    accent === a.value ? "ring-2 ring-fog-100 ring-offset-2 ring-offset-ink-950" : ""
                  }`}
                  style={{ backgroundColor: a.value }}
                />
              ))}
            </div>
            <div className="ml-auto flex gap-3">
              <button
                onClick={() => onExport("svg")}
                disabled={!data || exporting !== null}
                className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-[13px] font-medium transition-colors hover:border-fog-500/50 disabled:opacity-40"
              >
                {exporting === "svg" ? "Exporting…" : "SVG"}
              </button>
              <button
                onClick={() => onExport("png")}
                disabled={!data || exporting !== null}
                className="rounded-lg bg-neon-cyan px-4 py-2 text-[13px] font-bold text-ink-950 transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {exporting === "png" ? "Exporting…" : "PNG 2×"}
              </button>
            </div>
          </div>

          <div
            ref={svgHost}
            className="recap-host mt-6 overflow-hidden rounded-xl border border-ink-600/60 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          >
            {data ? (
              <RecapCard key={`${data.driverId}-${data.year}-${accent}`} data={data} accent={accent} />
            ) : (
              <div className="flex aspect-video items-center justify-center text-[13px] text-fog-500">Crunching season…</div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
