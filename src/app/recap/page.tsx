"use client";

import { useEffect, useRef, useState } from "react";
import { RecapCard, type RecapStatKey } from "@/components/recap/RecapCard";
import { LoadingLine, Skeleton } from "@/components/ui/Loading";
import { PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { getDb } from "@/lib/db/duckdb";
import { driverSeasonRecap, seasonDrivers, type RecapData } from "@/lib/db/recap";
import { f1dbSeasonCatalog } from "@/lib/db/catalog";
import { downloadPng, downloadSvg } from "@/lib/export";
import { useTheme } from "@/lib/theme";

const ACCENTS = [
  { name: "Racing red", value: "#e10600" },
  { name: "Ink", value: "#1c1710" },
  { name: "Blue", value: "#1e5aa8" },
  { name: "Green", value: "#1a7f4e" },
  { name: "Ochre", value: "#a07d00" },
];

export default function RecapPage() {
  const theme = useTheme();
  const paletteCustomized = useRef(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState("Starting…");
  const [year, setYear] = useState(2025);
  const [years, setYears] = useState<number[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [driverId, setDriverId] = useState("max-verstappen");
  const [rivalId, setRivalId] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0].value);
  const [background, setBackground] = useState(theme === "dark" ? "#080c0d" : "#eef2f1");
  const [ink, setInk] = useState(theme === "dark" ? "#edf3f3" : "#111718");
  const [showGrid, setShowGrid] = useState(true);
  const [showArc, setShowArc] = useState(true);
  const [showRounds, setShowRounds] = useState(true);
  const [showPosition, setShowPosition] = useState(true);
  const [customLabel, setCustomLabel] = useState("");
  const [visibleStats, setVisibleStats] = useState<RecapStatKey[]>(["wins", "podiums", "poles", "points", "fastestLaps"]);
  const [data, setData] = useState<RecapData | null>(null);
  const [exporting, setExporting] = useState<"svg" | "png" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("year")) setYear(Number(params.get("year")));
    if (params.get("driver")) setDriverId(params.get("driver")!);
    if (params.get("rival")) setRivalId(params.get("rival")!);
    if (params.get("accent")) setAccent(`#${params.get("accent")!.replace("#", "")}`);
    if (params.get("bg")) {
      paletteCustomized.current = true;
      setBackground(`#${params.get("bg")!.replace("#", "")}`);
    }
    if (params.get("ink")) {
      paletteCustomized.current = true;
      setInk(`#${params.get("ink")!.replace("#", "")}`);
    }
    if (params.get("label")) setCustomLabel(params.get("label")!);
    if (params.get("grid") === "0") setShowGrid(false);
    if (params.get("arc") === "0") setShowArc(false);
    if (params.get("rounds") === "0") setShowRounds(false);
    if (params.get("position") === "0") setShowPosition(false);
    const stats = params.get("stats")?.split(",").filter(Boolean) as RecapStatKey[] | undefined;
    if (stats?.length) setVisibleStats(stats);
  }, []);

  useEffect(() => {
    if (paletteCustomized.current) return;
    setBackground(theme === "dark" ? "#080c0d" : "#eef2f1");
    setInk(theme === "dark" ? "#edf3f3" : "#111718");
    setAccent(theme === "dark" ? "#ff3b30" : "#e10600");
  }, [theme]);

  useEffect(() => {
    getDb(setProgress)
      .then(() => f1dbSeasonCatalog())
      .then((catalog) => {
        const next = catalog.filter((entry) => entry.capabilities.has("recap")).map((entry) => entry.year);
        setYears(next);
        if (!next.includes(year) && next[0]) setYear(next[0]);
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!ready) return;
    seasonDrivers(year)
      .then((d) => {
        setDrivers(d);
        if (!d.some((x) => x.id === driverId) && d.length > 0) setDriverId(d[0].id);
        if (!d.some((x) => x.id === rivalId && x.id !== driverId)) setRivalId(d.find((x) => x.id !== driverId)?.id ?? "");
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, year]);

  useEffect(() => {
    if (!ready || !driverId) return;
    let stale = false;
    setData(null);
    driverSeasonRecap(year, driverId, rivalId || undefined)
      .then((d) => !stale && setData(d))
      .catch((e) => !stale && setError(String(e)));
    return () => {
      stale = true;
    };
  }, [ready, year, driverId, rivalId]);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams({
      year: String(year),
      driver: driverId,
      rival: rivalId,
      accent: accent.slice(1),
      bg: background.slice(1),
      ink: ink.slice(1),
      stats: visibleStats.join(","),
    });
    if (customLabel) params.set("label", customLabel);
    if (!showGrid) params.set("grid", "0");
    if (!showArc) params.set("arc", "0");
    if (!showRounds) params.set("rounds", "0");
    if (!showPosition) params.set("position", "0");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [ready, year, driverId, rivalId, accent, background, ink, visibleStats, customLabel, showGrid, showArc, showRounds, showPosition]);

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
      <PageTitle index="STUDIO / EXPORT.03" title="Season recap" sub="Choose the driver, comparison rival and palette. Results availability is derived from the bundled F1DB release." />

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
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
            <Select
              label="DRIVER"
              className="w-56"
              value={driverId}
              onValueChange={setDriverId}
              options={drivers.map((d, i) => ({ value: d.id, label: d.name, hint: `P${i + 1}` }))}
            />
            <Select
              label="COMPARISON RIVAL"
              className="w-56"
              value={rivalId || null}
              onValueChange={setRivalId}
              options={drivers.filter((driver) => driver.id !== driverId).map((driver) => ({ value: driver.id, label: driver.name }))}
            />
            <div className="flex h-10 items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  title={a.name}
                  onClick={() => { paletteCustomized.current = true; setAccent(a.value); }}
                  className={`h-7 w-7 rounded-full border border-ink/25 transition-transform hover:scale-110 ${
                    accent === a.value ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""
                  }`}
                  style={{ backgroundColor: a.value }}
                />
              ))}
              <input aria-label="Custom accent" title="Custom accent" type="color" value={accent} onChange={(event) => { paletteCustomized.current = true; setAccent(event.target.value); }} className="h-7 w-7 border border-ink/25 bg-transparent" />
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

          <Panel className="mt-5 p-4">
            <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
              <div>
                <SectionLabel>VISUAL PRESET</SectionLabel>
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {[
                    ["PAPER", "#eef2f1", "#111718", "#e10600"],
                    ["NIGHT", "#080c0d", "#edf3f3", "#ff3b30"],
                    ["SIGNAL", "#e9f1ef", "#0d1917", "#00a67d"],
                  ].map(([name, bg, text, signal]) => (
                    <button key={name} onClick={() => { paletteCustomized.current = true; setBackground(bg); setInk(text); setAccent(signal); }} className="border border-ink/15 px-2 py-2 font-mono text-[9px] text-ink-2 hover:border-red hover:text-ink">{name}</button>
                  ))}
                </div>
                <label className="mt-3 block text-[10px] tracking-[0.12em] text-ink-3">
                  REPORT LABEL
                  <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="BB / SEASON PERFORMANCE REPORT" className="mt-1 h-9 w-full border border-ink/20 bg-paper-2 px-3 text-[11px] text-ink outline-none focus:border-red" />
                </label>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="text-[9px] text-ink-3">BACKGROUND<input type="color" value={background} onChange={(event) => { paletteCustomized.current = true; setBackground(event.target.value); }} className="mt-1 h-8 w-full border border-ink/20 bg-transparent" /></label>
                  <label className="text-[9px] text-ink-3">INK<input type="color" value={ink} onChange={(event) => { paletteCustomized.current = true; setInk(event.target.value); }} className="mt-1 h-8 w-full border border-ink/20 bg-transparent" /></label>
                  <label className="text-[9px] text-ink-3">ACCENT<input type="color" value={accent} onChange={(event) => { paletteCustomized.current = true; setAccent(event.target.value); }} className="mt-1 h-8 w-full border border-ink/20 bg-transparent" /></label>
                </div>
              </div>
              <div>
                <SectionLabel>VISIBLE MODULES</SectionLabel>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["GRID", showGrid, setShowGrid],
                    ["POINTS TRACE", showArc, setShowArc],
                    ["ROUND MATRIX", showRounds, setShowRounds],
                    ["CHAMPIONSHIP POSITION", showPosition, setShowPosition],
                  ].map(([label, checked, setter]) => (
                    <label key={String(label)} className="flex items-center gap-2 border border-ink/10 bg-paper-2 px-3 py-2 text-[10px] text-ink-2">
                      <input type="checkbox" className="box" checked={checked as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} />
                      {label as string}
                    </label>
                  ))}
                </div>
                <div className="mt-5">
                  <SectionLabel>VISIBLE METRICS</SectionLabel>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {([
                      ["wins", "Wins"], ["podiums", "Podiums"], ["poles", "Poles"], ["points", "Points"], ["fastestLaps", "Fastest laps"],
                    ] as [RecapStatKey, string][]).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-[11px] text-ink-2">
                        <input type="checkbox" className="box" checked={visibleStats.includes(key)} onChange={() => setVisibleStats((current) => current.includes(key) ? (current.length > 1 ? current.filter((item) => item !== key) : current) : [...current, key])} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <div
            ref={svgHost}
            className="recap-host mt-6 overflow-hidden border border-ink/15 shadow-[0_24px_60px_-24px_var(--shadow-color)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          >
            {data ? (
              <RecapCard key={`${data.driverId}-${data.year}-${accent}-${background}-${ink}-${visibleStats.join("-")}`} data={data} accent={accent} background={background} ink={ink} visibleStats={visibleStats} showGrid={showGrid} showArc={showArc} showRounds={showRounds} showPosition={showPosition} customLabel={customLabel} />
            ) : (
              <Skeleton className="aspect-video w-full" />
            )}
          </div>
        </>
      )}
    </main>
  );
}
