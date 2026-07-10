"use client";

import { q } from "./duckdb";
import {
  assertSeasonYear,
  mergeSeasonCatalogs,
  type SeasonCapability,
  type SeasonCatalogEntry,
} from "@/lib/seasons";

interface YearRow {
  year: number;
}

const rowsToCatalog = (
  rows: readonly YearRow[],
  capability: SeasonCapability,
): SeasonCatalogEntry[] =>
  rows.map((row) => ({
    year: assertSeasonYear(Number(row.year)),
    capabilities: new Set<SeasonCapability>([capability]),
  }));

/** F1DB capabilities derived from rows loaded into DuckDB, never from release dates. */
export async function f1dbSeasonCatalog(): Promise<SeasonCatalogEntry[]> {
  const [h2h, scenarios, recap] = await Promise.all([
    q<YearRow>(`
      SELECT DISTINCT r.year
      FROM race_results r
      WHERE EXISTS (SELECT 1 FROM quali_results q WHERE q.year = r.year)
      ORDER BY r.year DESC`),
    q<YearRow>(`
      SELECT DISTINCT s.year
      FROM season_standings s
      WHERE EXISTS (SELECT 1 FROM races r WHERE r.year = s.year)
        AND EXISTS (SELECT 1 FROM race_results rr WHERE rr.year = s.year)
      ORDER BY s.year DESC`),
    q<YearRow>(`
      SELECT DISTINCT s.year
      FROM season_standings s
      WHERE EXISTS (SELECT 1 FROM race_results r WHERE r.year = s.year)
      ORDER BY s.year DESC`),
  ]);

  return mergeSeasonCatalogs(
    rowsToCatalog(h2h, "h2h"),
    rowsToCatalog(scenarios, "scenarios"),
    rowsToCatalog(recap, "recap"),
  );
}
