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
  { name: "Racing red", value: "#c8102e" },
  { name: "Ink", value: "#1c1710" },
  { name: "Blue", value: "#1e5aa8" },
  { name: "Green", value: "#1a7f4e" },
  { name: "Ochre", value: "#a07d00" },
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
      <PageTitle index="01" title="Circuit posters" sub="Official live-timing geometry, 2025 calendar. Print-ready SVG or PNG." />
      <div className="mt-6 flex flex-col gap-8 md:mt-8 lg:flex-row lg:gap-10">
        {/* controls */}
        <aside className="w-full shrink-0 lg:w-[300px]">
          <Panel>
            <div className="border-b border-ink/15 px-4 py-3">
              <SectionLabel accent={accent}>CIRCUIT — {String(index.length).padStart(2, "0")} TRACKS</SectionLabel>
            </div>
            <div className="panel-scroll max-h-[340px] overflow-y-auto">
              {index.map((c, i) => (
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
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
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
            className="w-full max-w-[560px] overflow-hidden border border-ink/15 shadow-[0_24px_60px_-24px_rgba(28,23,16,0.45)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
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
