/**
 * Server-side OpenF1 client: disk cache + polite sequential fetching.
 *
 * Free tier allows ~3 req/s. Every response is cached forever on disk
 * (.cache/openf1/) — historical data never changes, so the hot path costs
 * zero API calls after the first request.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".cache", "openf1");
const PAUSE_MS = 400;

let queue: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function openf1<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = `https://api.openf1.org/v1/${endpoint}?${qs}`;

  const key = createHash("sha1").update(url).digest("hex").slice(0, 24);
  const file = path.join(CACHE_DIR, `${endpoint}-${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // cache miss
  }

  // serialize network calls so parallel route handlers can't burst the API
  const task = queue.then(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenF1 ${endpoint}: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as T;
    await sleep(PAUSE_MS);
    return data;
  });
  queue = task.catch(() => {});
  const data = await task;

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}
