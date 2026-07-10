"use client";

import { useEffect, useRef, useState } from "react";
import { Poster } from "@/components/poster/Poster";
import { Skeleton } from "@/components/ui/Loading";
import { PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { fetchCircuitIndex, fetchResolvedCircuit } from "@/lib/circuits";
import { downloadPng, downloadSvg } from "@/lib/export";
import type { BakedCircuit, CircuitIndexEntry } from "@/lib/track/geometry";
import type { SessionInfo } from "@/lib/telemetry/types";
import { openF1SeasonCatalog } from "@/lib/seasons";
import { useTheme } from "@/lib/theme";

const COUNTRY_CODES: Record<string, string> = {
  Australia: "AUS", China: "CHN", Japan: "JPN", Bahrain: "BRN", "Saudi Arabia": "SAU",
  "United States": "USA", Italy: "ITA", Monaco: "MON", Spain: "ESP", Canada: "CAN",
  Austria: "AUT", "United Kingdom": "GBR", Belgium: "BEL", Hungary: "HUN",
  Netherlands: "NED", Azerbaijan: "AZE", Singapore: "SGP", Mexico: "MEX",
  Brazil: "BRA", Qatar: "QAT", "United Arab Emirates": "UAE",
};

const countryCode = (name: string) => COUNTRY_CODES[name] ?? name.slice(0, 3).toUpperCase();

const ACCENTS = [
  { name: "Racing red", value: "#e10600" },
  { name: "Ink", value: "#1c1710" },
  { name: "Blue", value: "#1e5aa8" },
  { name: "Green", value: "#1a7f4e" },
  { name: "Ochre", value: "#a07d00" },
];

export default function PosterPage() {
  const theme = useTheme();
  const paletteCustomized = useRef(false);
  const [index, setIndex] = useState<CircuitIndexEntry[]>([]);
  const [remoteEntries, setRemoteEntries] = useState<CircuitIndexEntry[]>([]);
  const [year, setYear] = useState(2025);
  const [slug, setSlug] = useState<string>("monza");
  const [circuit, setCircuit] = useState<BakedCircuit | null>(null);
  const [accent, setAccent] = useState(ACCENTS[0].value);
  const [showCorners, setShowCorners] = useState(true);
  const [showStart, setShowStart] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [background, setBackground] = useState(theme === "dark" ? "#080c0d" : "#eef2f1");
  const [ink, setInk] = useState(theme === "dark" ? "#edf3f3" : "#111718");
  const [lineWidth, setLineWidth] = useState(7);
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [exporting, setExporting] = useState<"svg" | "png" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryYear = Number(params.get("year"));
    if (queryYear >= 2023) setYear(queryYear);
    if (params.get("accent")) setAccent(`#${params.get("accent")!.replace("#", "")}`);
    if (params.get("bg")) {
      paletteCustomized.current = true;
      setBackground(`#${params.get("bg")!.replace("#", "")}`);
    }
    if (params.get("ink")) {
      paletteCustomized.current = true;
      setInk(`#${params.get("ink")!.replace("#", "")}`);
    }
    if (params.get("line")) setLineWidth(Number(params.get("line")));
    if (params.get("title")) setCustomTitle(params.get("title")!);
    if (params.get("subtitle")) setCustomSubtitle(params.get("subtitle")!);
    if (params.get("grid") === "0") setShowGrid(false);
    if (params.get("stats") === "0") setShowStats(false);
  }, []);

  useEffect(() => {
    if (paletteCustomized.current) return;
    setBackground(theme === "dark" ? "#080c0d" : "#eef2f1");
    setInk(theme === "dark" ? "#edf3f3" : "#111718");
    setAccent(theme === "dark" ? "#ff3b30" : "#e10600");
  }, [theme]);

  useEffect(() => {
    fetchCircuitIndex().then((entries) => {
      setIndex(entries);
      const requested = new URLSearchParams(window.location.search).get("track");
      const first = entries.find((entry) => entry.slug === requested) ?? entries.find((entry) => entry.year === year);
      if (first) setSlug(first.slug);
    }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let stale = false;
    const entry = [...index, ...remoteEntries].find((item) => item.slug === slug);
    if (!entry) return;
    fetchResolvedCircuit(entry.circuitKey, year)
      .then(({ circuit: next }) => !stale && setCircuit(next))
      .catch((e) => !stale && setError(String(e)));
    return () => {
      stale = true;
    };
  }, [slug, year, index, remoteEntries]);

  useEffect(() => {
    let stale = false;
    fetch(`/api/sessions?year=${year}`)
      .then((response) => response.json())
      .then((sessions: SessionInfo[]) => {
        if (stale) return;
        const meetings = new Map<number, SessionInfo>();
        for (const session of sessions) if (!meetings.has(session.meeting_key)) meetings.set(session.meeting_key, session);
        const entries = [...meetings.values()].map((session) => ({
          slug: `remote-${session.circuit_key}-${year}`,
          circuitKey: session.circuit_key,
          name: session.circuit_short_name,
          shortName: session.circuit_short_name,
          location: session.circuit_short_name,
          country: session.country_name,
          year,
          corners: 0,
          points: 0,
        }));
        setRemoteEntries(entries);
        const exact = index.filter((entry) => entry.year === year);
        const first = exact[0] ?? entries[0];
        if (first && ![...exact, ...entries].some((entry) => entry.slug === slug)) setSlug(first.slug);
      })
      .catch(() => setRemoteEntries([]));
    return () => { stale = true; };
  }, [year, index, slug]);

  const years = openF1SeasonCatalog().map((entry) => entry.year);
  const seasonIndex = [
    ...index.filter((entry) => entry.year === year),
    ...remoteEntries.filter((remote) => !index.some((entry) => entry.year === year && entry.circuitKey === remote.circuitKey)),
  ];
  const round = seasonIndex.findIndex((c) => c.slug === slug) + 1;

  useEffect(() => {
    const params = new URLSearchParams({
      year: String(year),
      track: slug,
      accent: accent.slice(1),
      bg: background.slice(1),
      ink: ink.slice(1),
      line: String(lineWidth),
    });
    if (customTitle) params.set("title", customTitle);
    if (customSubtitle) params.set("subtitle", customSubtitle);
    if (!showGrid) params.set("grid", "0");
    if (!showStats) params.set("stats", "0");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [year, slug, accent, background, ink, lineWidth, customTitle, customSubtitle, showGrid, showStats]);

  async function onExport(kind: "svg" | "png") {
    const el = svgHost.current?.querySelector("svg");
    if (!el || !circuit) return;
    setExporting(kind);
    try {
      const name = `boxbox-${circuit.slug}-${circuit.year}`;
      if (kind === "svg") await downloadSvg(el, name);
      else await downloadPng(el, name, 2);
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="STUDIO / COMPOSE.01" title="Circuit poster" sub="Season-specific geometry when available. Configure the visual system and export a self-contained SVG or PNG." />
      <div className="mt-6 flex flex-col gap-8 md:mt-8 lg:flex-row lg:gap-10">
        {/* controls */}
        <aside className="w-full shrink-0 lg:w-[300px]">
          <Panel>
            <div className="border-b border-ink/15 p-4">
              <Select label="SEASON / GEOMETRY" value={String(year)} onValueChange={(value) => {
                const nextYear = Number(value);
                setYear(nextYear);
                const first = index.find((entry) => entry.year === nextYear);
                if (first) setSlug(first.slug);
              }} options={years.map((item) => ({ value: String(item), label: String(item) }))} />
            </div>
            <div className="border-b border-ink/15 px-4 py-3">
              <SectionLabel accent={accent}>CIRCUIT — {String(seasonIndex.length).padStart(2, "0")} TRACKS</SectionLabel>
            </div>
            <div className="panel-scroll max-h-[340px] overflow-y-auto">
              {seasonIndex.map((c, i) => (
                <button
                  key={c.slug}
                  onClick={() => setSlug(c.slug)}
                  className={`flex w-full items-baseline gap-3 border-b border-ink/10 px-4 py-2.5 text-left text-[13px] transition-colors last:border-b-0 ${
                    c.slug === slug ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  <span className="w-6 shrink-0 font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{c.shortName}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wider text-ink-3">{countryCode(c.country)}</span>
                </button>
              ))}
              {seasonIndex.length === 0 && !error && (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel className="mt-5 p-4">
            <SectionLabel>COMPOSITION</SectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-1">
              {[
                ["PAPER", "#eef2f1", "#111718", "#e10600"],
                ["NIGHT", "#080c0d", "#edf3f3", "#ff3b30"],
                ["SIGNAL", "#e9f1ef", "#0d1917", "#00a67d"],
              ].map(([name, bg, text, signal]) => (
                <button key={name} onClick={() => { paletteCustomized.current = true; setBackground(bg); setInk(text); setAccent(signal); }} className="border border-ink/15 px-2 py-2 font-mono text-[9px] text-ink-2 hover:border-red hover:text-ink">{name}</button>
              ))}
            </div>
            <div className="mt-3 grid gap-3">
              <label className="text-[11px] text-ink-3">TITLE<input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder={circuit?.name ?? "Circuit name"} className="mt-1 h-9 w-full border border-ink/20 bg-paper-2 px-3 text-[12px] text-ink outline-none focus:border-red" /></label>
              <label className="text-[11px] text-ink-3">SUBTITLE<input value={customSubtitle} onChange={(event) => setCustomSubtitle(event.target.value)} placeholder="Location / edition" className="mt-1 h-9 w-full border border-ink/20 bg-paper-2 px-3 text-[12px] text-ink outline-none focus:border-red" /></label>
              <label className="text-[11px] text-ink-3">LINE WEIGHT · {lineWidth.toFixed(1)}<input type="range" min="2" max="14" step="0.5" value={lineWidth} onChange={(event) => setLineWidth(Number(event.target.value))} className="w-full" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] text-ink-3">BACKGROUND<input type="color" value={background} onChange={(event) => { paletteCustomized.current = true; setBackground(event.target.value); }} className="mt-1 h-9 w-full border border-ink/20 bg-transparent" /></label>
                <label className="text-[11px] text-ink-3">INK<input type="color" value={ink} onChange={(event) => { paletteCustomized.current = true; setInk(event.target.value); }} className="mt-1 h-9 w-full border border-ink/20 bg-transparent" /></label>
              </div>
            </div>
          </Panel>

          <div className="mt-5">
            <SectionLabel accent={accent}>ACCENT</SectionLabel>
            <div className="mt-3 flex gap-2.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  title={a.name}
                  onClick={() => { paletteCustomized.current = true; setAccent(a.value); }}
                  className={`h-8 w-8 rounded-full border border-ink/25 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    accent === a.value ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""
                  }`}
                  style={{ backgroundColor: a.value }}
                />
              ))}
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-center gap-3 text-[13px] text-ink-2">
            <input type="checkbox" checked={showCorners} onChange={(e) => setShowCorners(e.target.checked)} className="box" />
            Corner numbers
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-[13px] text-ink-2">
            <input type="checkbox" checked={showStart} onChange={(e) => setShowStart(e.target.checked)} className="box" />
            Start / finish marker
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-[13px] text-ink-2">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="box" />
            Coordinate grid
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-[13px] text-ink-2">
            <input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} className="box" />
            Layout specification
          </label>

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => onExport("svg")}
              disabled={!circuit || exporting !== null}
              className="h-10 flex-1 border border-ink/25 text-[13px] font-medium tracking-wide text-ink-2 transition-colors hover:border-ink/60 hover:text-ink disabled:opacity-40"
            >
              {exporting === "svg" ? "Exporting…" : "SVG"}
            </button>
            <button
              onClick={() => onExport("png")}
              disabled={!circuit || exporting !== null}
              className="h-10 flex-1 bg-ink text-[13px] font-semibold tracking-wide text-paper transition-colors hover:bg-red disabled:opacity-40"
            >
              {exporting === "png" ? "Exporting…" : "PNG 2×"}
            </button>
          </div>

          {error && (
            <div className="mt-4 border border-red/30 bg-red/5 px-4 py-3 text-[13px] text-red-deep">{error}</div>
          )}
        </aside>

        {/* preview */}
        <section className="flex min-w-0 flex-1 items-start justify-center">
          <div
            ref={svgHost}
            className="w-full max-w-[560px] overflow-hidden border border-ink/15 shadow-[0_24px_60px_-24px_var(--shadow-color)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          >
            {circuit ? (
              <Poster circuit={circuit} accent={accent} showCorners={showCorners} showStart={showStart} showGrid={showGrid} showStats={showStats} background={background} ink={ink} lineWidth={lineWidth} customTitle={customTitle} customSubtitle={customSubtitle} round={round > 0 ? round : undefined} />
            ) : (
              <Skeleton className="aspect-[3/4] w-full" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
