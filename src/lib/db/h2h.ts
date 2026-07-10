"use client";

import { q } from "./duckdb";
import { assertSeasonYear } from "@/lib/seasons";

export interface TechnicalH2HPair {
  constructorId: string;
  constructorName: string;
  driverA: string;
  driverB: string;
  nameA: string;
  nameB: string;
  rounds: number;
  qualiA: number;
  qualiB: number;
  raceA: number;
  raceB: number;
  sprintA: number;
  sprintB: number;
  pointsA: number;
  pointsB: number;
  avgGridA: number | null;
  avgGridB: number | null;
  avgFinishA: number | null;
  avgFinishB: number | null;
  reliabilityA: number;
  reliabilityB: number;
}

export interface H2HRound {
  round: number;
  race: string;
  qualiA: number | null;
  qualiB: number | null;
  gridA: number | null;
  gridB: number | null;
  finishA: number | null;
  finishB: number | null;
  pointsA: number;
  pointsB: number;
  gainedA: number | null;
  gainedB: number | null;
  retiredA: string | null;
  retiredB: string | null;
}

const pairKey = (constructorId: string, driverA: string, driverB: string) => `${constructorId}|${driverA}|${driverB}`;

export async function technicalH2H(yearValue: number): Promise<TechnicalH2HPair[]> {
  const year = assertSeasonYear(yearValue);
  const [race, quali, sprint, drivers, constructors] = await Promise.all([
    q<{
      cid: string; da: string; db: string; rounds: bigint; wa: bigint; wb: bigint;
      pa: number; pb: number; ga: number | null; gb: number | null; fa: number | null; fb: number | null;
      ra: bigint; rb: bigint;
    }>(`
      SELECT a.constructorId cid, a.driverId da, b.driverId db, COUNT(*) rounds,
        SUM(CASE WHEN a.positionNumber < b.positionNumber THEN 1 ELSE 0 END) wa,
        SUM(CASE WHEN b.positionNumber < a.positionNumber THEN 1 ELSE 0 END) wb,
        SUM(COALESCE(a.points, 0)) pa, SUM(COALESCE(b.points, 0)) pb,
        AVG(a.gridPositionNumber) ga, AVG(b.gridPositionNumber) gb,
        AVG(a.positionNumber) fa, AVG(b.positionNumber) fb,
        SUM(CASE WHEN a.positionNumber IS NOT NULL THEN 1 ELSE 0 END) ra,
        SUM(CASE WHEN b.positionNumber IS NOT NULL THEN 1 ELSE 0 END) rb
      FROM race_results a
      JOIN race_results b ON a.raceId=b.raceId AND a.constructorId=b.constructorId AND a.driverId < b.driverId
      WHERE a.year=${year}
      GROUP BY 1,2,3`),
    q<{ cid: string; da: string; db: string; wa: bigint; wb: bigint }>(`
      SELECT a.constructorId cid, a.driverId da, b.driverId db,
        SUM(CASE WHEN a.positionNumber < b.positionNumber THEN 1 ELSE 0 END) wa,
        SUM(CASE WHEN b.positionNumber < a.positionNumber THEN 1 ELSE 0 END) wb
      FROM quali_results a JOIN quali_results b
        ON a.raceId=b.raceId AND a.constructorId=b.constructorId AND a.driverId < b.driverId
      WHERE a.year=${year} AND a.positionNumber IS NOT NULL AND b.positionNumber IS NOT NULL
      GROUP BY 1,2,3`),
    q<{ cid: string; da: string; db: string; wa: bigint; wb: bigint; pa: number; pb: number }>(`
      SELECT a.constructorId cid, a.driverId da, b.driverId db,
        SUM(CASE WHEN a.positionNumber < b.positionNumber THEN 1 ELSE 0 END) wa,
        SUM(CASE WHEN b.positionNumber < a.positionNumber THEN 1 ELSE 0 END) wb,
        SUM(COALESCE(a.points,0)) pa, SUM(COALESCE(b.points,0)) pb
      FROM sprint_results a JOIN sprint_results b
        ON a.raceId=b.raceId AND a.constructorId=b.constructorId AND a.driverId < b.driverId
      WHERE a.year=${year} GROUP BY 1,2,3`),
    q<{ id: string; name: string }>("SELECT id,name FROM drivers"),
    q<{ id: string; constructorName: string }>("SELECT id, fullName AS constructorName FROM constructors"),
  ]);
  const names = new Map(drivers.map((row) => [row.id, row.name]));
  const teams = new Map(constructors.map((row) => [row.id, row.constructorName]));
  const qualiMap = new Map(quali.map((row) => [pairKey(row.cid, row.da, row.db), row]));
  const sprintMap = new Map(sprint.map((row) => [pairKey(row.cid, row.da, row.db), row]));
  return race
    .filter((row) => Number(row.rounds) >= 3)
    .map((row) => {
      const qr = qualiMap.get(pairKey(row.cid, row.da, row.db));
      const sr = sprintMap.get(pairKey(row.cid, row.da, row.db));
      return {
        constructorId: row.cid,
        constructorName: teams.get(row.cid) ?? row.cid,
        driverA: row.da,
        driverB: row.db,
        nameA: names.get(row.da) ?? row.da,
        nameB: names.get(row.db) ?? row.db,
        rounds: Number(row.rounds),
        qualiA: Number(qr?.wa ?? 0),
        qualiB: Number(qr?.wb ?? 0),
        raceA: Number(row.wa),
        raceB: Number(row.wb),
        sprintA: Number(sr?.wa ?? 0),
        sprintB: Number(sr?.wb ?? 0),
        pointsA: Number(row.pa) + Number(sr?.pa ?? 0),
        pointsB: Number(row.pb) + Number(sr?.pb ?? 0),
        avgGridA: row.ga == null ? null : Number(row.ga),
        avgGridB: row.gb == null ? null : Number(row.gb),
        avgFinishA: row.fa == null ? null : Number(row.fa),
        avgFinishB: row.fb == null ? null : Number(row.fb),
        reliabilityA: Number(row.ra),
        reliabilityB: Number(row.rb),
      };
    })
    .sort((a, b) => Math.max(b.pointsA, b.pointsB) - Math.max(a.pointsA, a.pointsB));
}

export async function h2hRounds(yearValue: number, pair: Pick<TechnicalH2HPair, "constructorId" | "driverA" | "driverB">): Promise<H2HRound[]> {
  const year = assertSeasonYear(yearValue);
  const esc = (value: string) => value.replaceAll("'", "''");
  const rows = await q<H2HRound>(`
    SELECT a.round, r.grandPrixId race,
      qa.positionNumber qualiA, qb.positionNumber qualiB,
      a.gridPositionNumber gridA, b.gridPositionNumber gridB,
      a.positionNumber finishA, b.positionNumber finishB,
      COALESCE(a.points,0) pointsA, COALESCE(b.points,0) pointsB,
      a.positionsGained gainedA, b.positionsGained gainedB,
      a.reasonRetired retiredA, b.reasonRetired retiredB
    FROM race_results a
    JOIN race_results b ON a.raceId=b.raceId AND a.constructorId=b.constructorId
    JOIN races r ON r.id=a.raceId
    LEFT JOIN quali_results qa ON qa.raceId=a.raceId AND qa.driverId=a.driverId
    LEFT JOIN quali_results qb ON qb.raceId=b.raceId AND qb.driverId=b.driverId
    WHERE a.year=${year} AND a.constructorId='${esc(pair.constructorId)}'
      AND a.driverId='${esc(pair.driverA)}' AND b.driverId='${esc(pair.driverB)}'
    ORDER BY a.round`);
  const num = (value: number | null) => value == null ? null : Number(value);
  return rows.map((row) => ({
    ...row,
    round: Number(row.round),
    qualiA: num(row.qualiA),
    qualiB: num(row.qualiB),
    gridA: num(row.gridA),
    gridB: num(row.gridB),
    finishA: num(row.finishA),
    finishB: num(row.finishB),
    pointsA: Number(row.pointsA),
    pointsB: Number(row.pointsB),
    gainedA: num(row.gainedA),
    gainedB: num(row.gainedB),
  }));
}
