"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/poster", label: "Posters" },
  { href: "/ghost", label: "Ghost lab" },
  { href: "/replay", label: "Replay" },
  { href: "/numbers", label: "The Numbers" },
  { href: "/recap", label: "Recap" },
  { href: "/live", label: "Live" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // close the sheet on navigation
  useEffect(() => setOpen(false), [pathname]);
  // lock scroll while the sheet is open
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-700/70 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-5 md:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="block h-2.5 w-2.5 bg-neon-cyan" />
          <span className="text-sm font-bold tracking-[0.25em]">BOXBOX</span>
        </Link>

        {/* desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative px-3 py-[17px] text-[13px] tracking-wide transition-colors ${
                  active ? "text-fog-100" : "text-fog-500 hover:text-fog-300"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-neon-cyan" />}
              </Link>
            );
          })}
        </nav>

        <span className="ml-auto hidden font-mono text-[10px] tracking-[0.3em] text-fog-500 md:block">F1 RACE LAB</span>

        {/* mobile burger */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="ml-auto flex h-9 w-9 flex-col items-center justify-center gap-[5px] md:hidden"
        >
          <span className={`h-[2px] w-5 bg-fog-100 transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`h-[2px] w-5 bg-fog-100 transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`h-[2px] w-5 bg-fog-100 transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </button>
      </div>

      {/* mobile sheet */}
      {open && (
        <nav className="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col bg-ink-950/98 px-6 pt-6 backdrop-blur md:hidden">
          {LINKS.map((l, i) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-baseline gap-4 border-b border-ink-700/60 py-5 ${active ? "text-fog-100" : "text-fog-300"}`}
              >
                <span className="w-8 font-mono text-[11px] text-fog-500">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xl font-bold tracking-tight">{l.label}</span>
                {active && <span className="ml-auto h-2 w-2 bg-neon-cyan" />}
              </Link>
            );
          })}
          <span className="mt-auto pb-8 pt-6 font-mono text-[10px] tracking-[0.3em] text-fog-500">F1 RACE LAB</span>
        </nav>
      )}
    </header>
  );
}
