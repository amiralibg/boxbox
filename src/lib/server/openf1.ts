/**
 * Server-side OpenF1 client: disk cache + polite sequential fetching.
 *
 * Free tier allows ~3 req/s. Every response is cached forever on disk
 * (.cache/openf1/) — historical data never changes, so the hot path costs
 * zero API calls after the first request.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".cache", "openf1");
const PAUSE_MS = 400;
const MAX_ATTEMPTS = 3;

let queue: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function openf1<T>(
  endpoint: string,
  params: Record<string, string | number>,
  opts: { maxAgeMs?: number } = {},
): Promise<T> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = `https://api.openf1.org/v1/${endpoint}?${qs}`;

  const key = createHash("sha1").update(url).digest("hex").slice(0, 24);
  const file = path.join(CACHE_DIR, `${endpoint}-${key}.json`);
  try {
    if (opts.maxAgeMs != null) {
      const { mtimeMs } = await stat(file);
      if (Date.now() - mtimeMs > opts.maxAgeMs) throw new Error("stale");
    }
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // cache miss or stale
  }

  // serialize network calls so parallel route handlers can't burst the API
  const task = queue.then(async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let res: Response;
      try {
        res = await fetch(url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === MAX_ATTEMPTS - 1) throw lastError;
        await sleep(600 * 2 ** attempt);
        continue;
      }
      if (res.ok) {
        const data = (await res.json()) as T;
        await sleep(PAUSE_MS);
        return data;
      }
      const detail = (await res.text()).slice(0, 180).replace(/\s+/g, " ");
      lastError = new Error(`OpenF1 ${endpoint}: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw lastError;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 600 * 2 ** attempt);
    }
    throw lastError ?? new Error(`OpenF1 ${endpoint}: request failed`);
  });
  queue = task.catch(() => {});
  const data = await task;

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}
