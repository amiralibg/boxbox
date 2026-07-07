# BoxBox — decisions log

F1 race lab: telemetry replays, ghost laps, circuit posters, historical analysis.
Full spec lives in the kickoff document; this file records *solved problems* so we
never relitigate them.

## Status

- **Phase 0 (data spikes): DONE.** `spikes/openf1-track-align.ts`, `spikes/duckdb-standings.ts`.
- **Phase 1 (circuit posters): DONE.** `/poster` route, all 24 2025 circuits, SVG/PNG export.
- Next: Phase 2 (ghost / lap-delta).

## Phase 1 decisions

- Circuit geometry baked offline via `pnpm bake:circuits [year]` → `public/circuits/*.json`
  + `index.json` (calendar order = round number). App never calls OpenF1/MultiViewer at
  runtime for posters.
- `src/lib/track/geometry.ts` is the TrackRenderer core: `makeProjector()` returns a
  `project()` that maps raw live-timing coords → screen. Reuse it for car dots in Phase 2 —
  do NOT write a second projection.
- Lap length computed from centerline polyline (`lapLengthMeters`), within ~0.5% of official.
- `Poster.tsx` is a pure self-contained SVG (inline styles only, no CSS classes) because
  export serializes the DOM node as a standalone file.
- Export (`src/lib/export.ts` = ExportLayer): Space Grotesk woff2 (self-hosted,
  `public/fonts/`) is inlined as base64 @font-face into exported SVG/PNG so text renders
  outside the app. PNG rasterizes via <img> + canvas at 2×.
- Design tokens in `globals.css` `@theme`: ink (charcoal) / fog (text) / neon accents.
  Tailwind v4, no config file.

## Solved: coordinate alignment (Phase 0)

- OpenF1 `location` x/y and MultiViewer circuit `x`/`y` arrays are **already in the
  same coordinate space** (both derive from F1 live timing). No translation needed —
  a car sample sits on the track polyline as-is (verified: mean distance 1.2 units,
  max 8.4, Monza 2024).
- The MultiViewer `rotation` (degrees) is **display-only**: rotate BOTH track and
  cars counter-clockwise around the track bbox center to get broadcast orientation.
  Rotation math in `spikes/openf1-track-align.ts` (`rotate()`).
- Units are ~decimeters. Track width ≈ 120–240 units. Alignment tolerance 150.
- SVG y-axis is flipped vs data y-axis — flip once at render time (`sy()`).
- OpenF1 emits `(0,0)` for missing position fixes — filter those out.
- Location sampling is ~3.8 Hz — interpolate for smooth playback (Phase 2 problem).

## Solved: historical queries (Phase 0)

- F1DB CSV dump (release v2026.9.1) bundled in `data/f1db/` (only tables we use so
  far). Full dump is 4.5 MB zipped — cheap to bundle more tables when needed.
- DuckDB-WASM runs the same `duckdb-eh.wasm` in Node (via `@duckdb/duckdb-wasm/blocking`
  + `NODE_RUNTIME`) and browser (AsyncDuckDB + worker). SQL is identical; spikes use
  the Node path, the app will use the browser path.
- Season points = race results points + sprint results points (two tables,
  UNION ALL). Verified 2024 top 10 recomputed == published standings.
- F1DB quirks: driver key is `driverId` (kebab-case slug); `points` can be NULL
  (COALESCE it); published standings table is `f1db-seasons-driver-standings.csv`.

## API endpoints in use

- OpenF1: `https://api.openf1.org/v1/{sessions,location,...}` — no key, ~3 req/s.
  Cache every response to disk (`spikes/.cache/`, gitignored).
- MultiViewer circuits: `https://api.multiviewer.app/api/v1/circuits/{circuit_key}/{year}`
  — gives track line, corners, `rotation`. `circuit_key` comes from the OpenF1 session.

## Conventions

- pnpm; TypeScript strict; scripts run with `pnpm exec tsx <file>`.
- Spikes and one-off scripts live in `spikes/`, outputs in `spikes/out/`.
- Never commit secrets; any token exchange stays server-side (Phase 6).
