"use client";

/**
 * ResultsStore: DuckDB-WASM singleton over the bundled F1DB CSVs.
 * Everything runs in the browser — The Numbers pillar has no backend.
 */
import * as duckdb from "@duckdb/duckdb-wasm";

const CSVS = [
  "f1db-races-race-results.csv",
  "f1db-races-sprint-race-results.csv",
  "f1db-races-qualifying-results.csv",
  "f1db-races.csv",
  "f1db-drivers.csv",
  "f1db-constructors.csv",
  "f1db-seasons-driver-standings.csv",
] as const;

// friendly view name per file
const VIEWS: Record<(typeof CSVS)[number], string> = {
  "f1db-races-race-results.csv": "race_results",
  "f1db-races-sprint-race-results.csv": "sprint_results",
  "f1db-races-qualifying-results.csv": "quali_results",
  "f1db-races.csv": "races",
  "f1db-drivers.csv": "drivers",
  "f1db-constructors.csv": "constructors",
  "f1db-seasons-driver-standings.csv": "season_standings",
};

let dbPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

export function getDb(onProgress?: (msg: string) => void): Promise<duckdb.AsyncDuckDBConnection> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    onProgress?.("Starting DuckDB…");
    const worker = new Worker("/duckdb/duckdb-browser-eh.worker.js");
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate("/duckdb/duckdb-eh.wasm");
    const conn = await db.connect();

    for (const file of CSVS) {
      onProgress?.(`Loading ${file.replace("f1db-", "").replace(".csv", "").replaceAll("-", " ")}…`);
      const res = await fetch(`/f1db/${file}`);
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      await db.registerFileBuffer(file, new Uint8Array(await res.arrayBuffer()));
      await conn.query(`CREATE VIEW ${VIEWS[file]} AS SELECT * FROM read_csv_auto('${file}')`);
    }
    onProgress?.("Ready");
    return conn;
  })();
  dbPromise.catch(() => (dbPromise = null)); // allow retry after failure
  return dbPromise;
}

/** query → array of plain row objects */
export async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const conn = await getDb();
  const table = await conn.query(sql);
  return table.toArray().map((r) => r.toJSON() as T);
}
