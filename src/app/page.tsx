"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCircuit } from "@/lib/circuits";
import { makeProjector, toClosedPath, type BakedCircuit } from "@/lib/track/geometry";

const TOOLS = [
  { href: "/poster", n: "01", title: "Circuit posters", blurb: "Circuit geometry from F1 live-timing coordinates, all 24 rounds. SVG/PNG export." },
  { href: "/ghost", n: "02", title: "Ghost lab", blurb: "Two laps overlaid at 20 Hz: speed, throttle, brake, gear, DRS, time delta by track position." },
  { href: "/replay", n: "03", title: "Replay", blurb: "Full-session playback, 20 cars: race order, gaps, flags, pit stops, stints, sector times." },
  { href: "/numbers", n: "04", title: "The Numbers", blurb: "1950–present in in-browser DuckDB. Teammate head-to-head and what-if points recomputation." },
  { href: "/recap", n: "05", title: "Recap", blurb: "Per-season driver stats and cumulative points arc vs the title rival. Exportable card." },
  { href: "/live", n: "06", title: "Live", blurb: "Delayed live positions over SSE, or any past session simulated through the same pipeline." },
];

/** Front page: oversized serif headline over a bare ink track line. */
export default function Home() {
  const [circuit, setCircuit] = useState<BakedCircuit | null>(null);

  useEffect(() => {
    fetchCircuit("monza").then(setCircuit).catch(() => {});
  }, []);

  const track = circuit ? makeProjector(circuit, { x: 10, y: 10, width: 620, height: 420 }).trackScreen : null;

  return (
    <main className="mx-auto max-w-6xl px-5 md:px-8">
      {/* hero */}
      <section className="grid items-center gap-10 py-14 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:py-20">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-red">FORMULA 1 RACE LAB</p>
          <h1 className="display mt-5 text-[44px] font-black leading-[1.02] md:text-[64px]">
            Every lap,
            <br />
            <span className="font-light italic">every signal.</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-2">
            Session replays, lap-delta telemetry, circuit geometry and 75 seasons of results —
            from F1 live-timing data (OpenF1) and F1DB.
          </p>
        </div>
        <div className="hidden md:block" aria-hidden>
          {track ? (
            <svg viewBox="0 0 640 440" className="w-full">
              <path d={toClosedPath(track)} fill="none" stroke="var(--color-ink)" strokeWidth={5} strokeLinejoin="round" />
              <circle cx={track[0][0]} cy={track[0][1]} r={8} fill="var(--color-red)" />
            </svg>
          ) : (
            <div className="aspect-[64/44] w-full" />
          )}
        </div>
      </section>

      {/* contents */}
      <section className="pb-10">
        <div className="rule-double pb-[5px]" />
        <div className="flex items-baseline justify-between pb-2 pt-3">
          <h2 className="font-mono text-[11px] tracking-[0.3em] text-ink-3">TOOLS</h2>
          <span className="font-mono text-[11px] tracking-[0.3em] text-ink-3">06</span>
        </div>
        <ol>
          {TOOLS.map((t) => (
            <li key={t.href} className="border-t border-ink/15 first:border-t-0">
              <Link href={t.href} className="group grid gap-1 py-6 md:grid-cols-[80px_minmax(0,5fr)_minmax(0,6fr)_40px] md:items-baseline md:gap-6">
                <span className="font-mono text-[13px] text-red">{t.n}</span>
                <span className="display text-[26px] font-bold leading-tight transition-colors group-hover:text-red md:text-[30px]">
                  {t.title}
                </span>
                <span className="text-[13px] leading-relaxed text-ink-2">{t.blurb}</span>
                <span className="hidden text-right text-[18px] text-ink-3 transition-all group-hover:translate-x-1 group-hover:text-red md:block">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
