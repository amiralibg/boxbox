"use client";

import { q } from "./duckdb";

export interface H2HPair {
  constructorId: string;
  constructorName: string;
  driverA: string;
  driverB: string;
  nameA: string;
  nameB: string;
  qualiA: number;
  qualiB: number;
  raceA: number;
  raceB: number;
  pointsA: number;
  pointsB: number;
  rounds: number;
}

/** Teammate pairings for a season with quali/race head-to-head counts and points. */
export async function teammateH2H(year: number): Promise<H2HPair[]> {
  const pairSql = (table: string) => `
    SELECT a.constructorId AS cid, a.driverId AS da, b.driverId AS db,
           SUM(CASE WHEN a.positionNumber < b.positionNumber THEN 1 ELSE 0 END) AS wa,
           SUM(CASE WHEN b.positionNumber < a.positionNumber THEN 1 ELSE 0 END) AS wb,
           COUNT(*) AS n
    FROM ${table} a
    JOIN ${table} b ON a.raceId = b.raceId AND a.constructorId = b.constructorId AND a.driverId < b.driverId
    WHERE a.year = ${year} AND a.positionNumber IS NOT NULL AND b.positionNumber IS NOT NULL
    GROUP BY 1, 2, 3`;

  const [quali, race, points, names, cons] = await Promise.all([
    q<{ cid: string; da: string; db: string; wa: bigint; wb: bigint; n: bigint }>(pairSql("quali_results")),
    q<{ cid: string; da: string; db: string; wa: bigint; wb: bigint; n: bigint }>(pairSql("race_results")),
    q<{ driverId: string; pts: number }>(`
      SELECT driverId, SUM(COALESCE(points, 0)) AS pts FROM (
        SELECT driverId, points FROM race_results WHERE year = ${year}
        UNION ALL
        SELECT driverId, points FROM sprint_results WHERE year = ${year}
      ) GROUP BY 1`),
    q<{ id: string; name: string }>(`SELECT id, name FROM drivers`),
    q<{ id: string; name: string }>(`SELECT id, fullName AS name FROM constructors`),
  ]);

  const nameOf = new Map(names.map((r) => [r.id, r.name]));
  const consOf = new Map(cons.map((r) => [r.id, r.name]));
  const ptsOf = new Map(points.map((r) => [r.driverId, Number(r.pts)]));

  const key = (cid: string, da: string, db: string) => `${cid}|${da}|${db}`;
  const raceMap = new Map(race.map((r) => [key(r.cid, r.da, r.db), r]));

  // seed from race pairs (some eras lack quali data), overlay quali counts
  const allKeys = new Set([...race.map((r) => key(r.cid, r.da, r.db)), ...quali.map((r) => key(r.cid, r.da, r.db))]);
  const qualiMap = new Map(quali.map((r) => [key(r.cid, r.da, r.db), r]));

  const pairs: H2HPair[] = [];
  for (const k of allKeys) {
    const [cid, da, db] = k.split("|");
    const qr = qualiMap.get(k);
    const rr = raceMap.get(k);
    const rounds = Number(rr?.n ?? qr?.n ?? 0);
    if (rounds < 3) continue; // one-off substitutes are noise
    pairs.push({
      constructorId: cid,
      constructorName: consOf.get(cid) ?? cid,
      driverA: da,
      driverB: db,
      nameA: nameOf.get(da) ?? da,
      nameB: nameOf.get(db) ?? db,
      qualiA: Number(qr?.wa ?? 0),
      qualiB: Number(qr?.wb ?? 0),
      raceA: Number(rr?.wa ?? 0),
      raceB: Number(rr?.wb ?? 0),
      pointsA: ptsOf.get(da) ?? 0,
      pointsB: ptsOf.get(db) ?? 0,
      rounds,
    });
  }
  return pairs.sort((a, b) => Math.max(b.pointsA, b.pointsB) - Math.max(a.pointsA, a.pointsB));
}

export interface SeasonMatrix {
  rounds: { round: number; name: string }[];
  drivers: { id: string; name: string }[];
  /** points[driverId][round] */
  points: Record<string, Record<number, number>>;
  /** published final standings for validation/comparison */
  official: { driverId: string; points: number; position: number }[];
}

/** Per-round points matrix for the what-if calculator. */
export async function seasonMatrix(year: number): Promise<SeasonMatrix> {
  const [cells, roundRows, official, names] = await Promise.all([
    q<{ driverId: string; round: number; pts: number }>(`
      SELECT driverId, round, SUM(COALESCE(points, 0)) AS pts FROM (
        SELECT driverId, round, points FROM race_results WHERE year = ${year}
        UNION ALL
        SELECT driverId, round, points FROM sprint_results WHERE year = ${year}
      ) GROUP BY 1, 2`),
    q<{ round: number; name: string }>(`SELECT round, grandPrixId AS name FROM races WHERE year = ${year} ORDER BY round`),
    q<{ driverId: string; points: number; position: number }>(`
      SELECT driverId, points, positionDisplayOrder AS position FROM season_standings WHERE year = ${year} ORDER BY position`),
    q<{ id: string; name: string }>(`SELECT id, name FROM drivers`),
  ]);

  const nameOf = new Map(names.map((r) => [r.id, r.name]));
  const points: SeasonMatrix["points"] = {};
  for (const c of cells) {
    const d = (points[c.driverId] ??= {});
    d[Number(c.round)] = Number(c.pts);
  }
  const driverIds = official.length > 0 ? official.map((o) => o.driverId) : Object.keys(points);
  return {
    rounds: roundRows.map((r) => ({ round: Number(r.round), name: r.name })),
    drivers: driverIds.map((id) => ({ id, name: nameOf.get(id) ?? id })),
    points,
    official: official.map((o) => ({ driverId: o.driverId, points: Number(o.points), position: Number(o.position) })),
  };
}
