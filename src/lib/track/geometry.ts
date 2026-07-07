/**
 * TrackRenderer core: pure geometry for circuit maps.
 *
 * Baked circuits (public/circuits/*.json) store the raw live-timing
 * coordinate space (~decimeters, y up, unrotated). OpenF1 car positions live
 * in the SAME space, so any transform built here applies to telemetry too —
 * solved in Phase 0, do not relitigate.
 */

export interface BakedCircuit {
  slug: string;
  circuitKey: number;
  name: string;
  shortName: string;
  location: string;
  country: string;
  year: number;
  rotation: number;
  x: number[];
  y: number[];
  corners: { number: number; x: number; y: number }[];
}

export interface CircuitIndexEntry {
  slug: string;
  circuitKey: number;
  name: string;
  shortName: string;
  location: string;
  country: string;
  year: number;
  corners: number;
  points: number;
}

export type Pt = [number, number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Counter-clockwise rotation by `deg` around `center`. */
export function rotatePoint([x, y]: Pt, deg: number, [cx, cy]: Pt): Pt {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

export function bounds(pts: Pt[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Maps raw circuit space → screen space: rotate by the circuit's broadcast
 * rotation, then uniformly scale/center into `viewport` with y flipped
 * (screen y grows down). Returned projector works for track points, corners,
 * and — later — live car positions.
 */
export function makeProjector(circuit: BakedCircuit, viewport: Rect) {
  const raw: Pt[] = circuit.x.map((x, i) => [x, circuit.y[i]]);
  const b = bounds(raw);
  const center: Pt = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];

  const rotated = raw.map((p) => rotatePoint(p, circuit.rotation, center));
  const rb = bounds(rotated);
  const scale = Math.min(viewport.width / (rb.maxX - rb.minX), viewport.height / (rb.maxY - rb.minY));
  const ox = viewport.x + (viewport.width - (rb.maxX - rb.minX) * scale) / 2;
  const oy = viewport.y + (viewport.height - (rb.maxY - rb.minY) * scale) / 2;

  const project = (p: Pt): Pt => {
    const [rx, ry] = rotatePoint(p, circuit.rotation, center);
    return [ox + (rx - rb.minX) * scale, oy + (rb.maxY - ry) * scale];
  };

  return { project, scale, trackScreen: rotated.map((p): Pt => [ox + (p[0] - rb.minX) * scale, oy + (rb.maxY - p[1]) * scale]) };
}

/**
 * Closed-loop centerline length in raw units (~decimeters). Within ~0.5% of
 * official lap length (Monza 5765 vs 5793, Spa 6963 vs 7004).
 */
export function lapLengthMeters(circuit: BakedCircuit): number {
  let sum = 0;
  const n = circuit.x.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += Math.hypot(circuit.x[j] - circuit.x[i], circuit.y[j] - circuit.y[i]);
  }
  return sum / 10;
}

/** Closed SVG path for a projected track line. */
export function toClosedPath(pts: Pt[], precision = 1): string {
  return (
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(precision)} ${y.toFixed(precision)}`).join("") + "Z"
  );
}
