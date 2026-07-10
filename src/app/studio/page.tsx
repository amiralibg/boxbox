import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/studio" },
};

const MODULES = [
  { href: "/studio/poster", id: "COMPOSE.01", title: "Poster", copy: "Build a circuit plate from season-specific geometry and export a self-contained artifact." },
  { href: "/studio/scenarios", id: "MODEL.02", title: "Scenarios", copy: "Change rounds and outcomes, then compare recomputed standings with the published season." },
  { href: "/studio/recap", id: "EXPORT.03", title: "Recap", copy: "Compose a driver season summary with selectable data, rival and presentation controls." },
];

export default function StudioIndex() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-6 md:py-14">
      <div className="font-mono text-[10px] tracking-[0.22em] text-red">DATA STUDIO / INDEX</div>
      <h1 className="display mt-4 text-4xl font-bold md:text-6xl">Configurable race artifacts</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-2">Choose the source, composition and output. Every export keeps its data context attached.</p>
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
