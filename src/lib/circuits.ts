import type { BakedCircuit, CircuitIndexEntry } from "@/lib/track/geometry";

const circuitCache = new Map<string, BakedCircuit>();
let indexCache: CircuitIndexEntry[] | null = null;

export interface CircuitResolution {
  entry: CircuitIndexEntry;
  exact: boolean;
  requestedYear: number;
}

export async function fetchCircuitIndex(): Promise<CircuitIndexEntry[]> {
  if (indexCache) return indexCache;
  const res = await fetch("/circuits/index.json");
  if (!res.ok) throw new Error(`circuit index: ${res.status}`);
  indexCache = (await res.json()) as CircuitIndexEntry[];
  return indexCache;
}

export async function fetchCircuit(slug: string): Promise<BakedCircuit> {
  const cached = circuitCache.get(slug);
  if (cached) return cached;
  const res = await fetch(`/circuits/${slug}.json`);
  if (!res.ok) throw new Error(`circuit ${slug}: ${res.status}`);
  const data = (await res.json()) as BakedCircuit;
  circuitCache.set(slug, data);
  return data;
}

/** Resolve by circuit and season. A fallback is always explicit to the caller. */
export async function resolveCircuit(circuitKey: number, year: number): Promise<CircuitResolution | null> {
  const entries = (await fetchCircuitIndex()).filter((entry) => entry.circuitKey === circuitKey);
  if (entries.length === 0) return null;
  const exact = entries.find((entry) => entry.year === year);
  if (exact) return { entry: exact, exact: true, requestedYear: year };
  const nearest = [...entries].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
  return { entry: nearest, exact: false, requestedYear: year };
}

export async function fetchResolvedCircuit(circuitKey: number, year: number): Promise<{
  circuit: BakedCircuit;
  resolution: CircuitResolution;
}> {
  const entries = (await fetchCircuitIndex()).filter((entry) => entry.circuitKey === circuitKey);
  const exact = entries.find((entry) => entry.year === year);
  if (exact) return { circuit: await fetchCircuit(exact.slug), resolution: { entry: exact, exact: true, requestedYear: year } };

  try {
    const response = await fetch(`/api/circuits/${year}/${circuitKey}`);
    if (response.ok) {
      const circuit = await response.json() as BakedCircuit;
      const entry: CircuitIndexEntry = {
        slug: circuit.slug,
        circuitKey,
        name: circuit.name,
        shortName: circuit.shortName,
        location: circuit.location,
        country: circuit.country,
        year,
        corners: circuit.corners.length,
        points: circuit.x.length,
      };
      circuitCache.set(entry.slug, circuit);
      return { circuit, resolution: { entry, exact: true, requestedYear: year } };
    }
  } catch {
    // offline/static deployments can still use the explicit nearest fallback
  }

  const resolution = await resolveCircuit(circuitKey, year);
  if (!resolution) throw new Error(`No circuit geometry for key ${circuitKey}`);
  return { circuit: await fetchCircuit(resolution.entry.slug), resolution };
}
