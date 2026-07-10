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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("boxbox-theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-paper text-ink">
        <SiteNav />
        {children}
        <footer className="mt-20 border-t border-ink/20">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-5 py-6 md:px-8">
            <span className="display text-[15px] font-black">
              BoxBox<span className="text-red">.</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-ink-3">
              DATA — OPENF1 · F1DB · MULTIVIEWER
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
