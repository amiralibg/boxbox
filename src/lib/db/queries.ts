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

/* ---------------- Season recap ---------------- */

export interface RecapData {
  driverId: string;
  name: string;
  firstName: string;
  lastName: string;
  teams: string[];
  year: number;
  finalPosition: number | null;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  /** per round: finishing position (null = DNF/DNS), race+sprint points */
  rounds: { round: number; position: number | null; classified: boolean; points: number }[];
  /** cumulative points per round, driver + rival */
  arc: { round: number; self: number; rival: number }[];
  rivalName: string;
  rivalPosition: number | null;
}

export async function seasonDrivers(year: number): Promise<{ id: string; name: string }[]> {
  return (
    await q<{ id: string; name: string }>(`
      SELECT d.id, d.name FROM season_standings s JOIN drivers d ON d.id = s.driverId
      WHERE s.year = ${year} ORDER BY s.positionDisplayOrder`)
  ).map((r) => ({ id: r.id, name: r.name }));
}

export async function driverSeasonRecap(year: number, driverId: string): Promise<RecapData> {
  const esc = driverId.replace(/'/g, "''");
  const [summary, teams, roundRows, standing, names] = await Promise.all([
    q<{ wins: bigint; podiums: bigint; poles: bigint; flaps: bigint }>(`
      SELECT
        COUNT(*) FILTER (WHERE positionNumber = 1) AS wins,
        COUNT(*) FILTER (WHERE positionNumber <= 3) AS podiums,
        COUNT(*) FILTER (WHERE polePosition) AS poles,
        COUNT(*) FILTER (WHERE fastestLap) AS flaps
      FROM race_results WHERE year = ${year} AND driverId = '${esc}'`),
    q<{ name: string }>(`
      SELECT DISTINCT c.fullName AS name FROM race_results r JOIN constructors c ON c.id = r.constructorId
      WHERE r.year = ${year} AND r.driverId = '${esc}'`),
    q<{ round: number; position: number | null; text: string; pts: number }>(`
      SELECT r.round AS round, r.positionNumber AS position, r.positionText AS text,
             COALESCE(r.points, 0) + COALESCE(s.points, 0) AS pts
      FROM race_results r
      LEFT JOIN sprint_results s ON s.year = r.year AND s.round = r.round AND s.driverId = r.driverId
      WHERE r.year = ${year} AND r.driverId = '${esc}' ORDER BY r.round`),
    q<{ driverId: string; position: number; points: number }>(`
      SELECT driverId, positionDisplayOrder AS position, points FROM season_standings
      WHERE year = ${year} ORDER BY positionDisplayOrder LIMIT 3`),
    q<{ id: string; name: string; firstName: string; lastName: string }>(`
      SELECT id, name, firstName, lastName FROM drivers`),
  ]);

  const me = standing.find((s) => s.driverId === driverId);
  // rival = champion, unless you ARE the champion — then the runner-up
  const rival = standing.find((s) => s.driverId !== driverId) ?? standing[0];
  const nameOf = new Map(names.map((n) => [n.id, n]));

  const rivalRounds = await q<{ round: number; pts: number }>(`
    SELECT r.round AS round, COALESCE(r.points, 0) + COALESCE(s.points, 0) AS pts
    FROM race_results r
    LEFT JOIN sprint_results s ON s.year = r.year AND s.round = r.round AND s.driverId = r.driverId
    WHERE r.year = ${year} AND r.driverId = '${rival.driverId.replace(/'/g, "''")}' ORDER BY r.round`);

  const rounds = roundRows.map((r) => ({
    round: Number(r.round),
    position: r.position == null ? null : Number(r.position),
    classified: /^\d+$/.test(r.text ?? ""),
    points: Number(r.pts),
  }));

  const allRounds = [...new Set([...rounds.map((r) => r.round), ...rivalRounds.map((r) => Number(r.round))])].sort((a, b) => a - b);
  const mineByRound = new Map(rounds.map((r) => [r.round, r.points]));
  const rivalByRound = new Map(rivalRounds.map((r) => [Number(r.round), Number(r.pts)]));
  let cs = 0;
  let cr = 0;
  const arc = allRounds.map((round) => {
    cs += mineByRound.get(round) ?? 0;
    cr += rivalByRound.get(round) ?? 0;
    return { round, self: cs, rival: cr };
  });

  const meName = nameOf.get(driverId);
  return {
    driverId,
    name: meName?.name ?? driverId,
    firstName: meName?.firstName ?? "",
    lastName: meName?.lastName ?? driverId,
    teams: teams.map((t) => t.name),
    year,
    finalPosition: me ? Number(me.position) : null,
    points: me ? Number(me.points) : rounds.reduce((a, r) => a + r.points, 0),
    wins: Number(summary[0]?.wins ?? 0),
    podiums: Number(summary[0]?.podiums ?? 0),
    poles: Number(summary[0]?.poles ?? 0),
    fastestLaps: Number(summary[0]?.flaps ?? 0),
    rounds,
    arc,
    rivalName: nameOf.get(rival.driverId)?.lastName ?? rival.driverId,
    rivalPosition: Number(rival.position),
  };
}
