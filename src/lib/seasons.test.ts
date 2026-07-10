import { describe, expect, it } from "vitest";
import { catalogFromYears, mergeSeasonCatalogs, openF1SeasonCatalog, selectSeasons } from "./seasons";

describe("season capabilities", () => {
  it("exposes every OpenF1 year through the current year", () => {
    expect(openF1SeasonCatalog(2026).map((entry) => entry.year)).toEqual([2026, 2025, 2024, 2023]);
  });

  it("merges source-specific capabilities without inventing common coverage", () => {
    const merged = mergeSeasonCatalogs(
      catalogFromYears([2023, 2024], "openf1"),
      catalogFromYears([1950, 2023], "h2h"),
    );
    expect(selectSeasons(merged, "openf1").map((entry) => entry.year)).toEqual([2024, 2023]);
    expect(merged.find((entry) => entry.year === 2023)?.capabilities).toEqual(new Set(["openf1", "h2h"]));
  });
});
