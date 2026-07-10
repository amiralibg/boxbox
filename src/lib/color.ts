/** Team-colour handling: normalize OpenF1 hex, keep it legible on either ground. */

import type { Theme } from "@/lib/theme";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]);
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)]);
}

/**
 * OpenF1 team_colour is a bare hex like "3671C6" (sometimes null). Normalize
 * and clamp for the active ground: on paper, pull anything too bright down
 * (Haas white, Williams pale blue…); on dark, lift anything too dark up
 * (Red Bull navy, Alpine…).
 */
export function teamColor(raw: string | null, theme: Theme = "paper", fallback?: string): string {
  const fb = fallback ?? (theme === "dark" ? "#ece4d2" : "#1c1710");
  if (!raw || !/^[0-9a-fA-F]{6}$/.test(raw)) return fb;
  let hex = `#${raw.toLowerCase()}`;
  if (theme === "dark") {
    while (luminance(hexToRgb(hex)) < 0.18) hex = lighten(hex, 0.15);
  } else {
    while (luminance(hexToRgb(hex)) > 0.38) hex = darken(hex, 0.15);
  }
  return hex;
}

/** Two drivers of one team arrive with identical colours — split them apart. */
export function distinctPair(a: string, b: string): [string, string] {
  if (a.toLowerCase() !== b.toLowerCase()) return [a, b];
  return [a, lighten(b, 0.35)];
}
