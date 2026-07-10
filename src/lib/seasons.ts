export type SeasonCapability = "openf1" | "circuits" | "h2h" | "scenarios" | "recap";

export interface SeasonCatalogEntry {
  year: number;
  capabilities: ReadonlySet<SeasonCapability>;
}

export interface SeasonOption {
  value: string;
  label: string;
}

export function assertSeasonYear(year: number): number {
  if (!Number.isSafeInteger(year) || year < 1950 || year > 9999) {
    throw new Error(`Invalid season year: ${String(year)}`);
  }
  return year;
}

export function openF1SeasonCatalog(currentYear = new Date().getUTCFullYear()): SeasonCatalogEntry[] {
  const end = Math.max(2023, assertSeasonYear(currentYear));
  return Array.from({ length: end - 2023 + 1 }, (_, offset) => ({
    year: end - offset,
    capabilities: new Set<SeasonCapability>(["openf1"]),
  }));
}

export function supportsCapability(entry: SeasonCatalogEntry, capability: SeasonCapability): boolean {
  return entry.capabilities.has(capability);
}

export function selectSeasons(
  catalog: readonly SeasonCatalogEntry[],
  capability: SeasonCapability,
): SeasonCatalogEntry[] {
  return catalog
    .filter((entry) => supportsCapability(entry, capability))
    .sort((a, b) => b.year - a.year);
}

export function seasonOptions(
  catalog: readonly SeasonCatalogEntry[],
  capability: SeasonCapability,
): SeasonOption[] {
  return selectSeasons(catalog, capability).map(({ year }) => ({
    value: String(year),
    label: String(year),
  }));
}

export function latestSeason(
  catalog: readonly SeasonCatalogEntry[],
  capability: SeasonCapability,
): number | null {
  return selectSeasons(catalog, capability)[0]?.year ?? null;
}

export function catalogFromYears(
  years: readonly number[],
  capability: SeasonCapability,
): SeasonCatalogEntry[] {
  return [...new Set(years.map(assertSeasonYear))].map((year) => ({
    year,
    capabilities: new Set<SeasonCapability>([capability]),
  }));
}

export function mergeSeasonCatalogs(
  ...catalogs: readonly (readonly SeasonCatalogEntry[])[]
): SeasonCatalogEntry[] {
  const merged = new Map<number, Set<SeasonCapability>>();
  for (const catalog of catalogs) {
    for (const entry of catalog) {
      const capabilities = merged.get(entry.year) ?? new Set<SeasonCapability>();
      entry.capabilities.forEach((capability) => capabilities.add(capability));
      merged.set(entry.year, capabilities);
    }
  }
  return [...merged.entries()]
    .map(([year, capabilities]) => ({ year, capabilities }))
    .sort((a, b) => b.year - a.year);
}
