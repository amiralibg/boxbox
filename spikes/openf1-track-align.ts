/**
 * Phase 0 spike A — prove the OpenF1 → track-map alignment pipe.
 *
 * 1. Fetch a session from OpenF1 (2024 Monza race).
 * 2. Fetch circuit geometry (track line + rotation) from MultiViewer.
 * 3. Fetch ~30s of car location samples for one driver.
 * 4. Rotate BOTH track and car points by the circuit `rotation` (display-only:
 *    OpenF1 location x/y and the MultiViewer track line share one coordinate
 *    space, so alignment holds with or without rotation — rotation just makes
 *    the map sit in its familiar broadcast orientation).
 * 5. Verify numerically: every car sample must sit within a small distance of
 *    the track polyline.
 * 6. Render track outline + car dot to SVG, rasterize to PNG with sharp.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(import.meta.dirname, "out");
const CACHE_DIR = path.join(import.meta.dirname, ".cache");

// ---------- fetch with disk cache (be a good API citizen) ----------

async function cachedJson<T>(name: string, url: string): Promise<T> {
  const file = path.join(CACHE_DIR, `${name}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // cache miss — fall through to network
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const data = (await res.json()) as T;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}

// ---------- types (only the fields we use) ----------

interface Session {
  session_key: number;
  circuit_key: number;
  year: number;
  circuit_short_name: string;
  date_start: string;
}

interface Circuit {
  rotation: number; // degrees
  x: number[];
  y: number[];
  corners: { number: number; trackPosition: { x: number; y: number } }[];
}

interface LocationSample {
  date: string;
  x: number;
  y: number;
  z: number;
}

// ---------- rotation (THE Phase 0 problem, solved once) ----------

type Pt = [number, number];

/** Counter-clockwise rotation by `deg` degrees around `center`. */
function rotate([x, y]: Pt, deg: number, [cx, cy]: Pt): Pt {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** Distance from point p to segment ab. */
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2));
  const qx = a[0] + t * abx;
  const qy = a[1] + t * aby;
  return Math.hypot(p[0] - qx, p[1] - qy);
}

function distToPolyline(p: Pt, line: Pt[]): number {
  let min = Infinity;
  for (let i = 0; i < line.length; i++) {
    const d = distToSegment(p, line[i], line[(i + 1) % line.length]);
    if (d < min) min = d;
  }
  return min;
}

// ---------- main ----------

async function main() {
  const [session] = await cachedJson<Session[]>(
    "session-monza-2024",
    "https://api.openf1.org/v1/sessions?year=2024&circuit_short_name=Monza&session_name=Race",
  );
  console.log(`session ${session.session_key} — ${session.circuit_short_name} ${session.year}`);

  const circuit = await cachedJson<Circuit>(
    `circuit-${session.circuit_key}-${session.year}`,
    `https://api.multiviewer.app/api/v1/circuits/${session.circuit_key}/${session.year}`,
  );
  console.log(`circuit: ${circuit.x.length} track points, rotation ${circuit.rotation}°`);

  const samples = await cachedJson<LocationSample[]>(
    `location-${session.session_key}-drv1`,
    `https://api.openf1.org/v1/location?session_key=${session.session_key}&driver_number=1` +
      `&date>2024-09-01T13:10:00&date<2024-09-01T13:10:30`,
  );
  const hz = samples.length / 30;
  console.log(`location: ${samples.length} samples in 30s (~${hz.toFixed(1)} Hz)`);

  // Rotate around the track's bounding-box center.
  const center: Pt = [
    (Math.min(...circuit.x) + Math.max(...circuit.x)) / 2,
    (Math.min(...circuit.y) + Math.max(...circuit.y)) / 2,
  ];
  const track: Pt[] = circuit.x.map((x, i) => rotate([x, circuit.y[i]], circuit.rotation, center));
  const cars: Pt[] = samples
    .filter((s) => s.x !== 0 || s.y !== 0) // OpenF1 emits (0,0) for missing fixes
    .map((s) => rotate([s.x, s.y], circuit.rotation, center));

  // Numeric acceptance: every rotated car sample sits on the rotated track line.
  const dists = cars.map((p) => distToPolyline(p, track));
  const maxDist = Math.max(...dists);
  const meanDist = dists.reduce((a, b) => a + b, 0) / dists.length;
  // Track coords are in decimeters (~1/10 m); half a track width ≈ 60–120 units.
  const TOLERANCE = 150;
  console.log(`alignment: mean ${meanDist.toFixed(1)}, max ${maxDist.toFixed(1)} (tolerance ${TOLERANCE})`);
  if (maxDist > TOLERANCE) throw new Error(`ALIGNMENT FAILED: max distance ${maxDist.toFixed(1)} > ${TOLERANCE}`);

  console.log("sample aligned XY (rotated):");
  for (const [x, y] of cars.slice(0, 5)) console.log(`  (${x.toFixed(0)}, ${y.toFixed(0)})`);

  await renderPng(track, cars, session);
  console.log("OK — spike A passed");
}

async function renderPng(track: Pt[], cars: Pt[], session: Session) {
  const xs = track.map((p) => p[0]);
  const ys = track.map((p) => p[1]);
  const pad = 800;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const w = maxX - minX;
  const h = maxY - minY;

  // SVG y grows downward; data y grows upward — flip y.
  const sx = (x: number) => x - minX;
  const sy = (y: number) => maxY - y;

  const trackPath =
    track.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(0)},${sy(y).toFixed(0)}`).join(" ") + " Z";
  const trail = cars
    .map(([x, y], i) => `<circle cx="${sx(x).toFixed(0)}" cy="${sy(y).toFixed(0)}" r="60" fill="#ff2d78" opacity="${(0.15 + (0.85 * i) / cars.length).toFixed(2)}"/>`)
    .join("\n  ");

  const outW = 1200;
  const outH = Math.round((outW * h) / w);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}">
  <rect width="100%" height="100%" fill="#0d0d14"/>
  <path d="${trackPath}" fill="none" stroke="#2de2e6" stroke-width="90" stroke-linejoin="round"/>
  ${trail}
</svg>`;

  await mkdir(OUT_DIR, { recursive: true });
  const svgFile = path.join(OUT_DIR, `${session.circuit_short_name.toLowerCase()}-${session.year}-align.svg`);
  const pngFile = svgFile.replace(/\.svg$/, ".png");
  await writeFile(svgFile, svg);
  await sharp(Buffer.from(svg), { density: 72 }).png().toFile(pngFile);
  console.log(`wrote ${pngFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
