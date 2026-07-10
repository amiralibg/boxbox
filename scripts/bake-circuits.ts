/**
 * Bake circuit geometry for offline use.
 *
 * Fetches the season's circuits from OpenF1, then each circuit's track line +
 * corners + rotation from MultiViewer, and writes compact JSON to
 * data/circuits/{slug}.json plus an index.json. Run once per season; the app
 * never hits these APIs at runtime.
 *
 *   pnpm exec tsx scripts/bake-circuits.ts [year]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const YEAR = Number(process.argv[2] ?? 2025);
const OUT_DIR = path.join(import.meta.dirname, "..", "public", "circuits");
const PAUSE_MS = 400; // stay well under OpenF1/MultiViewer rate limits

interface OpenF1Session {
  circuit_key: number;
  circuit_short_name: string;
  location: string;
  country_name: string;
}

interface MvCircuit {
  circuitName: string;
  rotation: number;
  x: number[];
  y: number[];
  corners: { number: number; angle: number; trackPosition: { x: number; y: number } }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const res = await fetch(`https://api.openf1.org/v1/sessions?year=${YEAR}&session_name=Race`);
  if (!res.ok) throw new Error(`OpenF1 sessions: ${res.status}`);
  const sessions = (await res.json()) as OpenF1Session[];

  // Unique circuits, calendar order.
  const circuits = new Map<number, OpenF1Session>();
  for (const s of sessions) if (!circuits.has(s.circuit_key)) circuits.set(s.circuit_key, s);
  console.log(`${YEAR}: ${circuits.size} circuits`);

  await mkdir(OUT_DIR, { recursive: true });
  let index: Array<{ circuitKey: number; year: number; [key: string]: unknown }> = [];
  try {
    index = JSON.parse(await readFile(path.join(OUT_DIR, "index.json"), "utf8"));
  } catch {
    // first bake
  }
  index = index.filter((entry) => entry.year !== YEAR);

  for (const s of circuits.values()) {
    await sleep(PAUSE_MS);
    const url = `https://api.multiviewer.app/api/v1/circuits/${s.circuit_key}/${YEAR}`;
    const r = await fetch(url);
    if (!r.ok) {
      console.warn(`SKIP ${s.circuit_short_name}: ${r.status}`);
      continue;
    }
    const mv = (await r.json()) as MvCircuit;
    const slug = `${slugify(s.circuit_short_name)}-${YEAR}`;

    const baked = {
      slug,
      circuitKey: s.circuit_key,
      name: mv.circuitName,
      shortName: s.circuit_short_name,
      location: s.location,
      country: s.country_name,
      year: YEAR,
      rotation: mv.rotation,
      // Track line in raw live-timing coordinates (~decimeters), unrotated.
      x: mv.x.map(Math.round),
      y: mv.y.map(Math.round),
      corners: mv.corners.map((c) => ({
        number: c.number,
        x: Math.round(c.trackPosition.x),
        y: Math.round(c.trackPosition.y),
      })),
    };

    await writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(baked));
    index.push({
      slug,
      circuitKey: baked.circuitKey,
      name: baked.name,
      shortName: baked.shortName,
      location: baked.location,
      country: baked.country,
      year: YEAR,
      corners: baked.corners.length,
      points: baked.x.length,
    });
    console.log(`baked ${slug} (${baked.x.length} pts, ${baked.corners.length} corners, rot ${baked.rotation}°)`);
  }

  index.sort((a, b) => b.year - a.year);
  await writeFile(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));
  console.log(`wrote index.json (${index.length} circuits)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
