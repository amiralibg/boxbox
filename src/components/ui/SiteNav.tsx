"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { setTheme, useTheme } from "@/lib/theme";

const LINKS = [
  { href: "/poster", label: "Posters" },
  { href: "/ghost", label: "Ghost lab" },
  { href: "/replay", label: "Replay" },
  { href: "/numbers", label: "The Numbers" },
  { href: "/recap", label: "Recap" },
  { href: "/live", label: "Live" },
];

/** Masthead-style theme switch: two words, the active one in full ink. */
function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "paper" : "dark")}
      aria-label="Switch theme"
      className={`font-mono text-[10px] tracking-[0.3em] ${className}`}
    >
      <span className={theme === "dark" ? "text-ink" : "text-ink-3 transition-colors hover:text-ink-2"}>DARK</span>
      <span className="text-ink-3"> / </span>
      <span className={theme === "paper" ? "text-ink" : "text-ink-3 transition-colors hover:text-ink-2"}>LIGHT</span>
    </button>
  );
}

/** Masthead: serif logotype, small-caps contents, newspaper double rule below. */
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
    <header className="sticky top-0 z-50 bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-10 px-5 md:px-8">
        <Link href="/" className="display text-[22px] font-black leading-none" onClick={() => setOpen(false)}>
          BoxBox<span className="text-red">.</span>
        </Link>

        {/* desktop */}
        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative py-[22px] text-[12px] font-medium uppercase tracking-[0.14em] transition-colors ${
                  active ? "text-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-0 bottom-[10px] h-[2px] bg-red" />}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle className="ml-auto hidden md:block" />

        {/* mobile burger */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="ml-auto flex h-9 w-9 flex-col items-center justify-center gap-[5px] md:hidden"
        >
          <span className={`h-[2px] w-5 bg-ink transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`h-[2px] w-5 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`h-[2px] w-5 bg-ink transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </button>
      </div>
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="rule-double pb-[5px]" />
      </div>

      {/* mobile sheet */}
      {open && (
        <nav className="fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col bg-paper px-6 pt-6 md:hidden">
          {LINKS.map((l, i) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-baseline gap-4 border-b border-ink/15 py-5 ${active ? "text-ink" : "text-ink-2"}`}
              >
                <span className="w-8 font-mono text-[11px] text-red">{String(i + 1).padStart(2, "0")}</span>
                <span className="display text-2xl font-bold">{l.label}</span>
                {active && <span className="ml-auto h-2 w-2 bg-red" />}
              </Link>
            );
          })}
          <div className="mt-auto flex items-baseline justify-between pb-8 pt-6">
            <span className="font-mono text-[10px] tracking-[0.3em] text-ink-3">F1 RACE LAB</span>
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
