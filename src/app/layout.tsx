import type { Metadata, Viewport } from "next";
import { SiteNav } from "@/components/ui/SiteNav";
import "uplot/dist/uPlot.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "BoxBox — F1 race lab",
  description: "Telemetry replays, ghost laps, circuit posters and championship analysis.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-fog-100">
        <SiteNav />
        {children}
        <footer className="mt-16 border-t border-ink-700/70">
          <div className="mx-auto max-w-7xl px-5 md:px-6">
            <div className="kerb h-[5px] w-24 opacity-60" />
            <div className="flex items-center justify-between py-6">
              <span className="font-mono text-[10px] tracking-[0.25em] text-fog-500">BOXBOX</span>
              <span className="font-mono text-[10px] tracking-wide text-fog-500">DATA · OPENF1 + F1DB + MULTIVIEWER</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
