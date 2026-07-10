# BoxBox — decisions log

F1 race lab: telemetry replays, ghost laps, circuit posters, historical analysis.
Full spec lives in the kickoff document; this file records *solved problems* so we
never relitigate them.

## Status

- **Phase 0 (data spikes): DONE.** `spikes/openf1-track-align.ts`, `spikes/duckdb-standings.ts`.
- **Phase 1 (circuit posters): DONE.** `/poster` route, all 24 2025 circuits, SVG/PNG export.
- **Phase 2 (ghost / lap-delta): DONE.** `/ghost` route.
- **Phase 3 (replay viewer): DONE.** `/replay` route.
- **Phase 4 (The Numbers): DONE.** `/numbers` route (H2H + what-if tabs).
- **Phase 5 (recap generator): DONE.** `/recap` route.
- **Phase 6 (live mode): DONE.** `/live` route. ALL SPEC PHASES COMPLETE.

## Redesign (2026-07): print editorial

- Replaced the dark ink/neon theme with a print-editorial system: warm paper
  ground (`paper/-2/-3`), warm ink text scale (`ink/-2/-3`), one racing-red
  accent (`red`, `red-deep`), support hues (`green/ochre/blue`) for status.
  Tokens in `globals.css` `@theme`; hairline rules via `border-ink/10..30`.
- Type: Fraunces variable (display serif, `.display` sets opsz 144) +
  Space Grotesk (UI sans) + JetBrains Mono (timing figures). Fraunces
  normal+italic self-hosted in `public/fonts/`. № glyph is NOT in the mono
  subset — use `Nº` (U+00BA).
- `teamColor()` now DARKENS bright team colours (luminance ≤ 0.38) for the
  light background — the old version lifted dark ones. Fallbacks are ink/red.
- Poster + RecapCard are paper SVGs; ExportLayer embeds Fraunces (both styles)
  + JetBrains Mono as base64. Sector/tyre conventions remapped for paper
  (purple 6d28d9, green 1a7f4e, yellow a07d00).
- Track canvases: paper-3 bed + ink hairline; chart chrome GRID #e2dac2,
  AXIS #8d8470, playhead ink.
- Home page is a real front page (masthead + contents), no longer a redirect.
- GOTCHA: Turbopack served stale CSS after the token rename — `rm -rf .next`
  if theme edits don't show up in dev.

## Phase 6 decisions

- `LiveFeed` interface in `src/lib/live/types.ts` (frames: t + car xy + optional
  order/gap updates). Only `DelayedRestFeed` implemented (free tier): polls OpenF1
  REST every 4s for the window since last poll, one frame per cycle. Live fetches
  bypass the disk cache deliberately — session data grows while running.
- `/api/live/[sessionKey]` = SSE. One feed instance per (impl, session, sim-config)
  fans out to all clients; stops when the last disconnects. 15s heartbeat.
  `LIVE_FEED` env selects implementation — SignalRFeed / OpenF1StreamFeed (sponsor
  token, token exchange MUST stay server-side) slot in later.
- **Simulation mode** (`?simulate=1&speed=N`, N clamped ≤120): virtual clock remaps
  a historical session to "now" so the identical pipeline is testable outside race
  weekends. UI has a Simulate toggle.
- GOTCHA: the starting grid is published with timestamps BEFORE date_start — the
  first poll must fetch position history unwindowed or the initial order has holes.
- GOTCHA: OpenF1 sessions endpoint returns the FULL season calendar including
  future races — filter date_start <= now before offering sessions as "latest".
- Client smoothing: cars tween linearly from previous to newest position over one
  poll interval (mutable Map read by rAF loop; no React state on the hot path).

## Phase 5 decisions

- `driverSeasonRecap()` (queries.ts) assembles wins/podiums/poles/FLs
  (polePosition / fastestLap boolean columns), per-round results, and a
  cumulative-points arc vs the rival (champion, or runner-up if you ARE champion).
- RecapCard is a pure SVG (1200×675, 16:9) exported through the same ExportLayer
  as posters. Draw-in animation is page CSS scoped under `.recap-host` targeting
  `.rc-arc` — deliberately NOT inside the SVG, so exports/PNG rasterization never
  capture a half-drawn line.
- Arc end labels get collision nudging when totals are close (2021: 395.5/387.5).
- DNS rows appear as positionText non-numeric → rendered as DNF ✕; fine for v1.

## Phase 4 decisions

- F1DB CSVs live in `public/f1db/` (7 tables, ~8 MB) and are fetched + registered
  as DuckDB file buffers in the browser. Views: race_results, sprint_results,
  quali_results, races, drivers, constructors, season_standings.
- DuckDB wasm + worker are copied to `public/duckdb/` by the `postinstall` script
  (gitignored — 36 MB). Browser singleton in `src/lib/db/duckdb.ts` (`getDb()`/`q()`);
  Arrow returns BigInt for counts — always `Number()` them.
- H2H pairs: self-join on raceId+constructorId with `driverId <` dedup; pairs with
  <3 shared rounds dropped (substitute noise). "Rounds" = both classified. Verified
  2024: VER-PER quali 23-1, NOR-PIA 20-4, points match standings.
- What-if: DuckDB produces a per-round points matrix once per season; exclusions
  (cancelled rounds, injected DNFs) recompute in JS instantly. Points-only —
  countback/ties not modelled (footnote in UI). Verified: 2021 baseline 395.5/387.5;
  cancelling Abu Dhabi gives 369.5/369.5.
- H2H bars use fixed cyan/magenta (A/B) — historical team colours don't exist in F1DB.

## Phase 3 decisions

- `/api/replay/[sessionKey]` bakes a whole session once to `.cache/replay/{key}.json`
  (~3.2 MB for a 2h race) and serves it from disk after. Bake = 20 per-driver
  location fetches (2 Hz resample, int coords) + `position` event list (race order)
  + `intervals` resampled to 0.25 Hz (gap to leader). First bake ~45s.
- Race order comes from the `position` endpoint events (authoritative);
  interval gaps are approximate (4s cadence, lapped cars filtered as strings) —
  order and gap can look slightly inconsistent for backmarkers; accepted for v1.
- Intervals only exist for races — quali/practice replays have no gap chart
  (page hides it).
- ReplayTrack rebuilds its canvas listener on highlight change (paused canvases
  don't tick, so highlight must be an effect dep, not a ref — learned the hard way).
- Gap chart: 20 series, y-inverted (leader top), acronym end-labels instead of a
  legend box, second teammate dashed, highlight dims others via series.alpha.
- Playback speeds 1–60×; leaderboard DOM updates throttled to every 2s of session
  time while playing.

## Phase 2 decisions

- Server bake: `/api/fastlap?session_key&driver_number` fetches laps + location +
  car_data from OpenF1, resamples to uniform 20 Hz grid (Catmull-Rom positions,
  linear scalars, hold for gear/DRS), returns `BakedLap` JSON. All OpenF1 calls go
  through `src/lib/server/openf1.ts` — forever disk cache (`.cache/openf1/`,
  gitignored) + serialized queue with 400ms gaps. DRS open = raw code >= 10.
- `TelemetryPlayer` (src/lib/telemetry/player.ts) is a rAF clock with subscriber
  callbacks — canvas/HUD/chart playheads read it imperatively, zero React re-renders
  at 60fps. Confirmed 60fps in headless Chromium.
- Ghost delta (src/lib/telemetry/delta.ts): laps are compared by lap-progress
  FRACTION, not absolute metres — GPS distance totals differ a few metres per lap;
  fraction-matching makes delta(finish) exactly equal the lap-time difference.
  Profile is boxcar-smoothed (window ~2.5% of lap, symmetric + edge-shrinking so
  endpoints stay exact) because inverting 3.7 Hz-derived distance profiles is jittery.
- Charts: uPlot small multiples (speed/throttle/brake/delta vs distance), cursor
  synced via uPlot.sync, playhead drawn in a draw-hook + rAF redraw, click-to-seek.
  Driver B series is dashed — same-team comparisons keep identity without color.
  Team colours via `teamColor()` (src/lib/color.ts): normalize OpenF1 bare hex,
  lift dark colours to luminance ≥ 0.18, `distinctPair()` splits same-team clashes.
- uPlot CSS imported in root layout (global CSS rule).

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
