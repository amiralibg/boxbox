"use client";

import { useEffect, useRef, useState } from "react";
import { Poster } from "@/components/poster/Poster";
import { Skeleton } from "@/components/ui/Loading";
import { PageTitle, Panel, SectionLabel } from "@/components/ui/Section";
import { fetchCircuit, fetchCircuitIndex } from "@/lib/circuits";
import { downloadPng, downloadSvg } from "@/lib/export";
import type { BakedCircuit, CircuitIndexEntry } from "@/lib/track/geometry";

const COUNTRY_CODES: Record<string, string> = {
  Australia: "AUS", China: "CHN", Japan: "JPN", Bahrain: "BRN", "Saudi Arabia": "SAU",
  "United States": "USA", Italy: "ITA", Monaco: "MON", Spain: "ESP", Canada: "CAN",
  Austria: "AUT", "United Kingdom": "GBR", Belgium: "BEL", Hungary: "HUN",
  Netherlands: "NED", Azerbaijan: "AZE", Singapore: "SGP", Mexico: "MEX",
  Brazil: "BRA", Qatar: "QAT", "United Arab Emirates": "UAE",
};

const countryCode = (name: string) => COUNTRY_CODES[name] ?? name.slice(0, 3).toUpperCase();

const ACCENTS = [
  { name: "Cyan", value: "#2de2e6" },
  { name: "Magenta", value: "#ff2d78" },
  { name: "Violet", value: "#a06cff" },
  { name: "Amber", value: "#ffb02e" },
  { name: "Green", value: "#3ff5a0" },
];

export default function PosterPage() {
  const [index, setIndex] = useState<CircuitIndexEntry[]>([]);
  const [slug, setSlug] = useState<string>("monza");
  const [circuit, setCircuit] = useState<BakedCircuit | null>(null);
  const [accent, setAccent] = useState(ACCENTS[0].value);
  const [showCorners, setShowCorners] = useState(true);
  const [exporting, setExporting] = useState<"svg" | "png" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCircuitIndex().then(setIndex).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let stale = false;
    fetchCircuit(slug)
      .then((c) => !stale && setCircuit(c))
      .catch((e) => !stale && setError(String(e)));
    return () => {
      stale = true;
    };
  }, [slug]);

  const round = index.findIndex((c) => c.slug === slug) + 1;

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
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        {/* controls */}
        <aside className="w-full shrink-0 lg:w-[300px]">
          <PageTitle index="01" title="Circuit posters" sub="Official live-timing geometry, 2025 calendar. Print-ready SVG or PNG." />

          <Panel className="mt-6">
            <div className="border-b border-ink-700/70 px-4 py-3">
              <SectionLabel accent={accent}>CIRCUIT — {String(index.length).padStart(2, "0")} TRACKS</SectionLabel>
            </div>
            <div className="panel-scroll max-h-[340px] overflow-y-auto">
              {index.map((c, i) => (
                <button
                  key={c.slug}
                  onClick={() => setSlug(c.slug)}
                  className={`flex w-full items-baseline gap-3 border-b border-ink-700/40 px-4 py-2.5 text-left text-[13px] transition-colors last:border-b-0 ${
                    c.slug === slug ? "bg-ink-700/70 text-fog-100" : "text-fog-300 hover:bg-ink-800 hover:text-fog-100"
                  }`}
                >
                  <span className="w-6 shrink-0 font-mono text-[11px] text-fog-500">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{c.shortName}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wider text-fog-500">{countryCode(c.country)}</span>
                </button>
              ))}
              {index.length === 0 && !error && (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <div className="mt-6">
            <SectionLabel accent={accent}>ACCENT</SectionLabel>
            <div className="mt-3 flex gap-2.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  title={a.name}
                  onClick={() => setAccent(a.value)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fog-100 ${
                    accent === a.value ? "ring-2 ring-fog-100 ring-offset-2 ring-offset-ink-950" : ""
                  }`}
                  style={{ backgroundColor: a.value }}
                />
              ))}
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-center gap-3 text-[13px] text-fog-300">
            <input type="checkbox" checked={showCorners} onChange={(e) => setShowCorners(e.target.checked)} className="box" />
            Corner numbers
          </label>

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => onExport("svg")}
              disabled={!circuit || exporting !== null}
              className="h-10 flex-1 border border-ink-600 bg-ink-800 text-[13px] font-medium tracking-wide transition-colors hover:border-fog-500/50 hover:bg-ink-700 disabled:opacity-40"
            >
              {exporting === "svg" ? "Exporting…" : "SVG"}
            </button>
            <button
              onClick={() => onExport("png")}
              disabled={!circuit || exporting !== null}
              className="chamfer h-10 flex-1 bg-neon-cyan text-[13px] font-bold tracking-wide text-ink-950 transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {exporting === "png" ? "Exporting…" : "PNG 2×"}
            </button>
          </div>

          {error && (
            <div className="mt-4 border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-3 text-[13px] text-neon-magenta">{error}</div>
          )}
        </aside>

        {/* preview */}
        <section className="flex min-w-0 flex-1 items-start justify-center">
          <div
            ref={svgHost}
            className="w-full max-w-[560px] overflow-hidden border border-ink-700/70 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          >
            {circuit ? (
              <Poster circuit={circuit} accent={accent} showCorners={showCorners} round={round > 0 ? round : undefined} />
            ) : (
              <Skeleton className="aspect-[3/4] w-full" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
