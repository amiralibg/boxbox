import type { Metadata, Viewport } from "next";
import { SiteNav } from "@/components/ui/SiteNav";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "uplot/dist/uPlot.min.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "BoxBox — Formula One Data System",
    template: "%s · BoxBox",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "sports",
  creator: "BoxBox",
  publisher: "BoxBox",
  keywords: [
    "Formula One telemetry",
    "F1 replay",
    "F1 lap comparison",
    "F1 head to head",
    "circuit map",
    "race strategy",
    "OpenF1",
    "F1DB",
  ],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/brand/boxbox-mark.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: "BoxBox — Formula One Data System",
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "BoxBox Formula One Data System" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BoxBox — Formula One Data System",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080c0d" },
    { media: "(prefers-color-scheme: light)", color: "#f2f5f5" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL.toString(),
    description: SITE_DESCRIPTION,
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
  };
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("boxbox-theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body className="min-h-screen bg-paper text-ink">
        <SiteNav />
        {children}
        <footer className="mt-20 border-t border-ink/20">
          <div className="mx-auto flex max-w-7xl flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-5 py-6 md:px-6">
            <span className="font-mono text-[12px] font-bold">BB / BOXBOX</span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-ink-3">
              SOURCES — OPENF1 · F1DB · MULTIVIEWER / CAPABILITY-AWARE
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
