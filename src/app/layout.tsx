import type { Metadata } from "next";
import Link from "next/link";
import "uplot/dist/uPlot.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "BoxBox — F1 race lab",
  description: "Telemetry replays, ghost laps, circuit posters and championship analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-fog-100">
        <header className="border-b border-ink-600/60">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="block h-2.5 w-2.5 bg-neon-cyan" />
              <span className="text-sm font-bold tracking-[0.25em]">BOXBOX</span>
            </Link>
            <nav className="flex items-center gap-6 text-[13px] tracking-wide text-fog-300">
              <Link href="/poster" className="transition-colors hover:text-fog-100">
                Posters
              </Link>
              <Link href="/ghost" className="transition-colors hover:text-fog-100">
                Ghost lab
              </Link>
              <Link href="/replay" className="transition-colors hover:text-fog-100">
                Replay
              </Link>
              <Link href="/numbers" className="transition-colors hover:text-fog-100">
                The Numbers
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
