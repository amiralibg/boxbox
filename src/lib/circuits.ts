import type { BakedCircuit, CircuitIndexEntry } from "@/lib/track/geometry";

const circuitCache = new Map<string, BakedCircuit>();
let indexCache: CircuitIndexEntry[] | null = null;

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
