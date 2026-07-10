"use client";

import { useEffect, useRef, useState } from "react";
import { RecapCard } from "@/components/recap/RecapCard";
import { LoadingLine, Skeleton } from "@/components/ui/Loading";
import { PageTitle } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { getDb } from "@/lib/db/duckdb";
import { driverSeasonRecap, seasonDrivers, type RecapData } from "@/lib/db/queries";
import { downloadPng, downloadSvg } from "@/lib/export";

const YEARS = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i);
const ACCENTS = [
  { name: "Racing red", value: "#c8102e" },
  { name: "Ink", value: "#1c1710" },
  { name: "Blue", value: "#1e5aa8" },
  { name: "Green", value: "#1a7f4e" },
  { name: "Ochre", value: "#a07d00" },
];

export default function RecapPage() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState("Starting…");
  const [year, setYear] = useState(2025);
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

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="05" title="Recap" sub="Any driver, any season since 1950 — one shareable card." />

      {error && (
        <div className="mt-4 border border-red/30 bg-red/5 px-4 py-3 text-[13px] text-red-deep">{error}</div>
      )}
      {!ready && !error && (
        <div className="mt-8">
          <LoadingLine>{progress}</LoadingLine>
          <Skeleton className="mt-5 aspect-video w-full" />
        </div>
      )}

      {ready && (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <Select
              label="SEASON"
              className="w-32"
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
            />
            <Select
              label="DRIVER"
              className="w-56"
              value={driverId}
              onValueChange={setDriverId}
              options={drivers.map((d, i) => ({ value: d.id, label: d.name, hint: `P${i + 1}` }))}
            />
            <div className="flex h-10 items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  title={a.name}
                  onClick={() => setAccent(a.value)}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    accent === a.value ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""
                  }`}
                  style={{ backgroundColor: a.value }}
                />
              ))}
            </div>
            <div className="flex gap-3 md:ml-auto">
              <button
                onClick={() => onExport("svg")}
                disabled={!data || exporting !== null}
                className="h-10 border border-ink/25 px-4 text-[13px] font-medium text-ink-2 transition-colors hover:border-ink/60 hover:text-ink disabled:opacity-40"
              >
                {exporting === "svg" ? "Exporting…" : "SVG"}
              </button>
              <button
                onClick={() => onExport("png")}
                disabled={!data || exporting !== null}
                className="h-10 bg-ink px-4 text-[13px] font-semibold text-paper transition-colors hover:bg-red disabled:opacity-40"
              >
                {exporting === "png" ? "Exporting…" : "PNG 2×"}
              </button>
            </div>
          </div>

          <div
            ref={svgHost}
            className="recap-host mt-6 overflow-hidden border border-ink/15 shadow-[0_24px_60px_-24px_rgba(28,23,16,0.45)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          >
            {data ? (
              <RecapCard key={`${data.driverId}-${data.year}-${accent}`} data={data} accent={accent} />
            ) : (
              <Skeleton className="aspect-video w-full" />
            )}
          </div>
        </>
      )}
    </main>
  );
}
