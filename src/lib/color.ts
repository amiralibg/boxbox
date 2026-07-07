/** Team-colour handling: normalize OpenF1 hex, keep it legible on charcoal. */

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

/**
 * OpenF1 team_colour is a bare hex like "3671C6" (sometimes null). Normalize
 * and lift anything too dark to read against the ink background.
 */
export function teamColor(raw: string | null, fallback = "#2de2e6"): string {
  if (!raw || !/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
  let hex = `#${raw.toLowerCase()}`;
  while (luminance(hexToRgb(hex)) < 0.18) hex = lighten(hex, 0.15);
  return hex;
}

/** Two drivers of one team arrive with identical colours — split them apart. */
export function distinctPair(a: string, b: string): [string, string] {
  if (a.toLowerCase() !== b.toLowerCase()) return [a, b];
  return [a, lighten(b, 0.55)];
}
