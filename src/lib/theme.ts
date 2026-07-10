"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme switching: `data-theme` on <html> drives the CSS var overrides in
 * globals.css. Dark ("night") is the default — the inline script in layout.tsx
 * sets the attribute before first paint.
 */

export type Theme = "paper" | "dark";

const KEY = "boxbox-theme";
const EVENT = "boxbox:theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "paper" ? "paper" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  palette = null; // invalidate before listeners re-read
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeTheme(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, () => "dark");
}

/** Chrome colours for canvases and uPlot charts (they can't read CSS vars). */
export type ChartPalette = {
  grid: string;
  axis: string;
  trackBed: string;
  ink: string;
  inkFaint: string; // hairline over the track bed
};

let palette: ChartPalette | null = null;

export function chartPalette(): ChartPalette {
  if (palette) return palette;
  if (typeof document === "undefined") {
    return { grid: "#2c2418", axis: "#7a715e", trackBed: "#241e15", ink: "#ece4d2", inkFaint: "rgba(236,228,210,0.5)" };
  }
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const ink = v("--color-ink") || "#1c1710";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  palette = {
    grid: v("--chart-grid") || "#e2dac2",
    axis: v("--chart-axis") || "#8d8470",
    trackBed: v("--track-bed") || "#e6dfca",
    ink,
    inkFaint: `rgba(${r}, ${g}, ${b}, 0.5)`,
  };
  return palette;
}
