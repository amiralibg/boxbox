import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/lab" },
};

const MODULES = [
  { href: "/lab/replay", id: "SESSION.01", title: "Replay", copy: "Reconstruct a session from position, timing, race-control, weather and strategy channels." },
  { href: "/lab/ghost", id: "LAP.02", title: "Ghost", copy: "Compare two fastest laps over distance with synchronized telemetry and exact finish delta." },
  { href: "/lab/h2h", id: "HISTORY.03", title: "Head to head", copy: "Audit teammate performance over comparable rounds, sessions and reliability states." },
];

export default function LabIndex() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-6 md:py-14">
      <div className="font-mono text-[10px] tracking-[0.22em] text-red">TECHNICAL LAB / INDEX</div>
      <h1 className="display mt-4 text-4xl font-bold md:text-6xl">Race analysis workspace</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-2">Dense, synchronized views of the timing channels. Availability follows the source: telemetry begins in 2023; historical result analysis begins in 1950.</p>
      <div className="mt-10 grid gap-px border border-ink/15 bg-ink/15 md:grid-cols-3">
        {MODULES.map((module) => (
          <Link key={module.href} href={module.href} className="group min-h-64 bg-paper p-6 transition-colors hover:bg-paper-2">
            <span className="font-mono text-[10px] text-red">{module.id}</span>
            <h2 className="mt-16 text-2xl font-semibold group-hover:text-red">{module.title}</h2>
            <p className="mt-3 text-[13px] leading-5 text-ink-2">{module.copy}</p>
            <span className="mt-6 block font-mono text-[10px] text-ink-3">OPEN MODULE →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
