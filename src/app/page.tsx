"use client";

import Link from "next/link";

const AREAS = [
  {
    href: "/lab",
    code: "LAB",
    title: "Technical Lab",
    blurb: "Inspect sessions, compare drivers, and read race data at source cadence.",
    tools: [
      ["Replay", "Synchronized track, order, gaps, events, strategy and telemetry.", "/lab/replay"],
      ["Ghost", "Fastest-lap overlay with 20 Hz controls and delta trace.", "/lab/ghost"],
      ["Head to head", "Shared-round teammate analysis from 1950 onward.", "/lab/h2h"],
    ],
  },
  {
    href: "/studio",
    code: "STD",
    title: "Data Studio",
    blurb: "Compose, recompute and export F1 data as configurable artifacts.",
    tools: [
      ["Poster", "Year-aware circuit geometry with editable composition.", "/studio/poster"],
      ["Scenarios", "Recalculate championships under controlled changes.", "/studio/scenarios"],
      ["Recap", "Configurable season summaries and comparison arcs.", "/studio/recap"],
    ],
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-6 md:py-16">
      <section className="grid min-h-[38vh] content-between border border-ink/15 bg-paper-2/70 p-6 md:grid-cols-[1fr_320px] md:p-10">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-red">FORMULA ONE / DATA SYSTEM</div>
          <h1 className="display mt-6 max-w-3xl text-5xl font-bold leading-[0.94] md:text-7xl">Read the race.<br />Not the broadcast.</h1>
          <p className="mt-6 max-w-xl text-[14px] leading-6 text-ink-2">
            Session telemetry from OpenF1 and historical results from F1DB, separated by capability and exposed without invented precision.
          </p>
        </div>
        <dl className="mt-10 grid grid-cols-2 gap-px self-end bg-ink/15 font-mono text-[10px] md:mt-0 md:grid-cols-1">
          {[["TELEMETRY", "2023—NOW"], ["RESULTS", "1950—NOW"], ["POSITION", "~3.7 HZ"], ["LAP DATA", "SESSION NATIVE"]].map(([k, v]) => (
            <div key={k} className="bg-paper p-3"><dt className="text-ink-3">{k}</dt><dd className="mt-1 text-ink">{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        {AREAS.map((area) => (
          <article key={area.href} className="border border-ink/15 bg-paper">
            <Link href={area.href} className="block border-b border-ink/15 p-5 hover:bg-paper-2">
              <div className="font-mono text-[10px] text-red">{area.code} / 03 MODULES</div>
              <h2 className="mt-3 text-2xl font-semibold">{area.title}</h2>
              <p className="mt-2 text-[13px] leading-5 text-ink-2">{area.blurb}</p>
            </Link>
            {area.tools.map(([title, blurb, href], i) => (
              <Link key={href} href={href} className="group grid grid-cols-[28px_1fr] gap-3 border-b border-ink/10 p-4 last:border-b-0 hover:bg-paper-2">
                <span className="font-mono text-[10px] text-ink-3">0{i + 1}</span>
                <span><strong className="text-[13px] group-hover:text-red">{title}</strong><span className="mt-1 block text-[12px] text-ink-3">{blurb}</span></span>
              </Link>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}
