<p align="center">
  <img src="src/app/icon.svg" width="96" alt="BoxBox logo — a circuit loop shaped like the letter B">
</p>

<h1 align="center">BoxBox</h1>

<p align="center"><strong>F1 race lab</strong> — telemetry replays, ghost laps, circuit posters and championship analysis, all in the browser.</p>

---

## What's inside

| Route | What it does |
| --- | --- |
| `/poster` | Print-ready circuit posters from official live-timing geometry — SVG/PNG export, all 24 circuits |
| `/ghost` | Two fastest laps overlaid on one track: live delta, sector times, minisectors, speed trap, tyre |
| `/replay` | Whole-session replay, every car — running order, gap chart, tyre strategy, lap-by-lap timing sheet |
| `/numbers` | Teammate head-to-head and what-if title calculator over every season since 1950, queried in-browser with DuckDB WASM |
| `/recap` | Shareable season recap card for any driver since 1950 |
| `/live` | Live session viewer — delayed REST feed streamed over SSE with smooth client-side playback; simulation mode replays any finished session through the same pipeline |

## Stack

- **Next.js** (App Router) + TypeScript strict + Tailwind v4
- **Canvas** track views (60 fps rAF playback, zero React on the hot path), **uPlot** telemetry charts
- **DuckDB WASM** for historical queries — the F1DB CSV dump is queried entirely client-side
- Data: [OpenF1](https://openf1.org) (telemetry, timing), [F1DB](https://github.com/f1db/f1db) (history since 1950), [MultiViewer](https://multiviewer.app) (circuit geometry)

## Getting started

```bash
pnpm install        # postinstall copies DuckDB wasm into public/duckdb/
pnpm dev
```

First telemetry request per session/driver bakes from OpenF1 onto disk (`.cache/`, gitignored) — a full race replay takes about a minute once, then loads instantly.

```bash
pnpm bake:circuits [year]   # refresh circuit geometry in public/circuits/
```

## Notes

- OpenF1 free tier is rate-limited (~3 req/s); the server client queues and disk-caches every response.
- Live mode ships with the free delayed REST feed; SignalR / sponsor-token stream feeds slot in behind the same `LiveFeed` interface (token exchange stays server-side).
