import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDuckDB, NODE_RUNTIME, VoidLogger } from "@duckdb/duckdb-wasm/blocking";

const root = path.join(import.meta.dirname, "..");
const dist = path.join(root, "node_modules", "@duckdb", "duckdb-wasm", "dist");
const data = path.join(root, "public", "f1db");
const files: Record<string, string> = {
  race_results: "f1db-races-race-results.csv",
  quali_results: "f1db-races-qualifying-results.csv",
  sprint_results: "f1db-races-sprint-race-results.csv",
  races: "f1db-races.csv",
  constructors: "f1db-constructors.csv",
};

async function main() {
  const db = await createDuckDB({ eh: { mainModule: path.join(dist, "duckdb-eh.wasm") } }, new VoidLogger(), NODE_RUNTIME);
  await db.instantiate();
  const conn = db.connect();
  for (const [view, file] of Object.entries(files)) {
    db.registerFileBuffer(file, new Uint8Array(await readFile(path.join(data, file))));
    conn.query(`CREATE VIEW ${view} AS SELECT * FROM read_csv_auto('${file}')`);
  }

  const summary = conn.query(`
  SELECT a.constructorId cid, a.driverId da, b.driverId db, COUNT(*) rounds,
    SUM(CASE WHEN a.positionNumber < b.positionNumber THEN 1 ELSE 0 END) wa,
    SUM(COALESCE(a.points,0)) pa, AVG(a.gridPositionNumber) ga
  FROM race_results a JOIN race_results b
    ON a.raceId=b.raceId AND a.constructorId=b.constructorId AND a.driverId < b.driverId
  WHERE a.year=2024 GROUP BY 1,2,3 ORDER BY rounds DESC LIMIT 3`).toArray();

  const detail = conn.query(`
  SELECT a.round, r.grandPrixId race, qa.positionNumber qualiA,
    a.gridPositionNumber gridA, a.positionNumber finishA
  FROM race_results a
  JOIN race_results b ON a.raceId=b.raceId AND a.constructorId=b.constructorId
  JOIN races r ON r.id=a.raceId
  LEFT JOIN quali_results qa ON qa.raceId=a.raceId AND qa.driverId=a.driverId
  WHERE a.year=2024 AND a.constructorId='mclaren'
    AND a.driverId='lando-norris' AND b.driverId='oscar-piastri'
  ORDER BY a.round`).toArray();
  const constructorNames = conn.query("SELECT id, fullName AS constructorName FROM constructors LIMIT 3").toArray();

  if (summary.length === 0 || detail.length !== 24 || constructorNames.length !== 3) throw new Error(`Unexpected H2H rows: ${summary.length}/${detail.length}/${constructorNames.length}`);
  console.log(`OK — H2H summary ${summary.length}; McLaren detail ${detail.length}; constructor aliases ${constructorNames.length}`);
  conn.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
