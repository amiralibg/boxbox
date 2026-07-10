<p align="center">
  <img src="public/brand/boxbox-mark.svg" width="86" alt="BoxBox — Formula One Data System">
</p>

<p align="center"><strong>Formula One data system</strong> — telemetry replay, lap comparison, technical analysis and configurable exports.</p>

---

## What's inside

| Route | What it does |
| --- | --- |
| `/lab/replay` | Whole-session reconstruction from position, timing, race-control, weather, pit and telemetry channels |
| `/lab/ghost` | Two fastest laps overlaid with synchronized telemetry, sector data and exact finish delta |
| `/lab/h2h` | Technical teammate comparison across qualifying, races, points and reliability |
| `/studio/poster` | Configurable circuit plates from season-specific geometry with SVG/PNG export |
| `/studio/scenarios` | Championship recomputation with configurable rounds, outcomes and scoring systems |
| `/studio/recap` | Configurable driver season summaries covering every available historical season |

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

Set `NEXT_PUBLIC_SITE_URL` to the production origin so canonical URLs, the sitemap,
robots file and social metadata use the deployed domain.

First telemetry request per session/driver bakes from OpenF1 onto disk (`.cache/`, gitignored) — a full race replay takes about a minute once, then loads instantly.

```bash
pnpm bake:circuits [year]   # refresh circuit geometry in public/circuits/
```

## Notes

- OpenF1 free tier is rate-limited (~3 req/s); the server client queues and disk-caches every response.
- Telemetry availability follows OpenF1 (2023 onward); historical result analysis follows F1DB (1950 onward).
