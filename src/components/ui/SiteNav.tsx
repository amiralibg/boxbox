"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { setTheme, useTheme } from "@/lib/theme";

const GROUPS = [
  {
    href: "/lab",
    label: "Technical Lab",
    links: [
      { href: "/lab/replay", label: "Replay" },
      { href: "/lab/ghost", label: "Ghost" },
      { href: "/lab/h2h", label: "H2H" },
    ],
  },
  {
    href: "/studio",
    label: "Studio",
    links: [
      { href: "/studio/poster", label: "Poster" },
      { href: "/studio/scenarios", label: "Scenarios" },
      { href: "/studio/recap", label: "Recap" },
    ],
  },
];

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
    <header className="sticky top-0 z-50 border-b border-ink/15 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-5 md:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-mono text-[15px] font-bold tracking-[-0.04em]" onClick={() => setOpen(false)} aria-label="BoxBox home">
          <img src="/brand/boxbox-mark.svg" alt="" width={28} height={28} className="h-7 w-7" />
          <span>BOXBOX</span>
        </Link>

        <nav className="hidden h-full items-center gap-8 md:flex">
          {GROUPS.map((group) => {
            const active = pathname.startsWith(group.href);
            return (
              <div key={group.href} className="flex h-full items-center gap-3">
                <Link href={group.href} className={`font-mono text-[9px] tracking-[0.2em] ${active ? "text-red" : "text-ink-3"}`}>
                  {group.label.toUpperCase()}
                </Link>
                {group.links.map((link) => {
                  const selected = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative flex h-full items-center text-[12px] font-medium transition-colors ${
                        selected ? "text-ink" : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      {link.label}
                      {selected && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-red" />}
                    </Link>
                  );
                })}
              </div>
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
      {open && typeof document !== "undefined" && createPortal(
        <nav
          role="dialog"
          aria-modal="true"
          aria-label="Main navigation"
          className="fixed inset-x-0 bottom-0 top-14 z-40 isolate flex flex-col overflow-y-auto border-t border-ink/15 px-6 pt-6 shadow-2xl md:hidden"
          style={{ backgroundColor: "var(--color-paper)" }}
        >
          {GROUPS.map((group) => (
            <section key={group.href} className="mb-7">
              <Link href={group.href} className="font-mono text-[10px] tracking-[0.22em] text-red">
                {group.label.toUpperCase()}
              </Link>
              <div className="mt-2 border-t border-ink/20">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center border-b border-ink/10 py-4 text-xl font-semibold">
                    {link.label}
                    {pathname.startsWith(link.href) && <span className="ml-auto h-2 w-2 bg-red" />}
                  </Link>
                ))}
              </div>
            </section>
          ))}
          <div className="mt-auto flex items-baseline justify-between pb-8 pt-6">
            <span className="font-mono text-[10px] tracking-[0.2em] text-ink-3">DATA SOURCES · OPENF1 / F1DB</span>
            <ThemeToggle />
          </div>
        </nav>,
        document.body,
      )}
    </header>
  );
}
