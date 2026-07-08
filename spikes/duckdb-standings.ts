/**
 * Phase 0 spike B — prove the F1DB → DuckDB-WASM pipe.
 *
 * Runs the actual WASM build (same engine the browser will use, via the Node
 * worker bundle), loads bundled F1DB CSVs, and:
 *   1. queries the published 2024 final driver standings;
 *   2. recomputes standings from raw race + sprint results (what-if math);
 *   3. asserts the two agree — proves we can recompute title fights from rows.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
// Node-blocking bindings run the same duckdb-eh.wasm engine the browser uses;
// in the app it'll be AsyncDuckDB + a browser worker, SQL identical.
import { createDuckDB, NODE_RUNTIME, VoidLogger } from "@duckdb/duckdb-wasm/blocking";

const DATA_DIR = path.join(import.meta.dirname, "..", "public", "f1db");
const DIST = path.join(import.meta.dirname, "..", "node_modules", "@duckdb", "duckdb-wasm", "dist");

async function main() {
  const db = await createDuckDB(
    { eh: { mainModule: path.join(DIST, "duckdb-eh.wasm") } },
    new VoidLogger(),
    NODE_RUNTIME,
  );
  await db.instantiate();
  const conn = db.connect();

  for (const file of ["f1db-seasons-driver-standings.csv", "f1db-races-race-results.csv", "f1db-races-sprint-race-results.csv", "f1db-drivers.csv"]) {
    db.registerFileBuffer(file, new Uint8Array(await readFile(path.join(DATA_DIR, file))));
  }

  // 1. Published final standings, 2024 top 10.
  const published = conn.query(`
    SELECT s.positionNumber AS pos, d.name, s.points
    FROM read_csv_auto('f1db-seasons-driver-standings.csv') s
    JOIN read_csv_auto('f1db-drivers.csv') d ON d.id = s.driverId
    WHERE s.year = 2024
    ORDER BY s.positionDisplayOrder
    LIMIT 10
  `);

  console.log("2024 final driver standings (published):");
  const pubRows = published.toArray().map((r) => r.toJSON());
  for (const r of pubRows) console.log(`  ${String(r.pos).padStart(2)}  ${r.name}  ${r.points}`);

  // 2. Recompute from raw results: race points + sprint points per driver.
  const computed = conn.query(`
    WITH pts AS (
      SELECT driverId, points FROM read_csv_auto('f1db-races-race-results.csv') WHERE year = 2024
      UNION ALL
      SELECT driverId, points FROM read_csv_auto('f1db-races-sprint-race-results.csv') WHERE year = 2024
    )
    SELECT driverId, SUM(COALESCE(points, 0)) AS points
    FROM pts
    GROUP BY driverId
    ORDER BY points DESC
    LIMIT 10
  `);
  const compRows = computed.toArray().map((r) => r.toJSON());

  console.log("recomputed from race + sprint results:");
  for (const r of compRows) console.log(`  ${r.driverId}  ${r.points}`);

  // 3. Cross-check totals.
  const pubByPoints = pubRows.map((r) => Number(r.points));
  const compByPoints = compRows.map((r) => Number(r.points));
  for (let i = 0; i < 10; i++) {
    if (pubByPoints[i] !== compByPoints[i]) {
      throw new Error(`MISMATCH at rank ${i + 1}: published ${pubByPoints[i]} vs computed ${compByPoints[i]}`);
    }
  }

  // Known ground truth, independent of F1DB.
  if (Number(pubRows[0].points) !== 437 || pubRows[0].name !== "Max Verstappen") {
    throw new Error(`Expected Verstappen champion with 437, got ${pubRows[0].name} ${pubRows[0].points}`);
  }

  conn.close();
  console.log("OK — spike B passed (published == recomputed, champion correct)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
