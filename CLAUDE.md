# CLAUDE.md — Ridgeline

> Working title: **Ridgeline** (rename freely). A weather + gear planning tool for
> Appalachian Trail thru-hikers.

This file is loaded at the start of every Claude Code session. Keep it high-signal.
Read `docs/PRD.md` for full product detail and `docs/BUILD_PLAN.md` for the phased task list.

## What this app is

A planning tool that projects a thru-hiker's position over the course of a 4–8 month
hike and shows the **typical weather** (from historical climate *normals*) they can
expect at each point, so they can plan gear changes in advance. It is a planning aid,
not a live forecast and not a gear-inventory/pack-weight manager.

## The three ideas that drive the whole design

1. **Position-over-time is the engine.** Given a start date, direction, and pace, the
   app projects where the hiker is on any calendar date. Weather, daylight, and gear
   all become lookups against "where am I / when is it." Get this projection right and
   everything else hangs off it.

2. **We use climate NORMALS, not forecasts.** Nobody can forecast a date four months
   out. We show historical typical conditions (30-year normals). This is why the whole
   weather dataset is *static* and can be precomputed — there is **no weather API call
   at runtime**.

3. **Elevation correction is the core value.** Weather stations sit in towns/valleys;
   the trail rides the ridges. Raw station data gives misleadingly warm numbers. We
   correct every temperature for the elevation difference between the station and the
   actual trail point using a lapse rate (~3.5°F cooler per 1,000 ft). This correction
   is the difference between a useless number and a trip-saving one. Never show an
   uncorrected trail temperature.

## Architecture (important: no backend)

```
Build time:  scripts/build-climate.ts  --hits ACIS API-->  src/data/climate.json
Static data: src/data/waypoints.json  (hand-curated, checked into repo)
Runtime:     React SPA loads the two JSON files, does all math in-browser,
             persists the user's plan to localStorage. Deploys as a static site.
```

- **No server, no database, no auth** for MVP. If you find yourself reaching for one,
  stop and re-read this section — the normals-are-static insight is what removes them.
- The ACIS API is touched **only** by the build-time pipeline script, never by the
  browser. (This also sidesteps CORS entirely.)

## Stack

- React + TypeScript, built with Vite
- Tailwind CSS for styling
- Zustand (with `persist` middleware → localStorage) for the plan state
- **Leaflet.js** for mapping, with **OpenStreetMap** tiles (no key, free, static-friendly)
  — **post-MVP only**: the shipped MVP has no map view; do not add Leaflet unless a map
  feature is actually being built
- `suncalc` for sunrise/sunset/day-length/moon-phase (computed, no API)
- Vitest for unit tests
- Build pipeline script in TypeScript, run with `tsx`/`node`

## Domain model (see src/domain/types.ts)

- **Waypoint** — a curated point on the trail: `{ id, name, trailMile, lat, lng,
  trailElevationFt, isResupply, stationId, stationElevationFt }`. `stationId` is the
  assigned ACIS station; `stationElevationFt` is that station's elevation (for the
  lapse correction).
- **DailyNormal** — per station, per day-of-year (1–366): `{ normalMaxF, normalMinF,
  normalPrecipIn, freezeProbability, precipProbability }`.
- **TripPlan** (user state, persisted) — `{ startDate, direction, paceMilesPerDay,
  gear: GearItem[], swaps: GearSwap[] }`. Direction is `"NOBO"` only for MVP.
- **GearItem** — `{ id, name, category, comfortThresholdF?, notes? }`. The threshold
  is **optional**: if present, the app can *suggest* swap points; if absent, the item
  is managed purely manually.
- **GearSwap** — user-placed at a waypoint: `{ waypointId, addItemIds, removeItemIds }`.
- **Projection** (derived, never persisted) — computed from TripPlan + waypoints +
  climate: arrival date per waypoint, corrected high/low per waypoint, daylight & moon
  per waypoint, and suggested swap points.

## Key formulas & invariants

- **Arrival date:** `startDate + (trailMile / paceMilesPerDay)` days. NOBO starts at
  mile 0 (Springer Mtn, GA) heading to the northern terminus.
- **Lapse correction:** `correctedF = stationF - LAPSE_RATE_PER_FT * (trailElevFt -
  stationElevFt)`. Default `LAPSE_RATE_PER_FT = 0.0035` (3.5°F / 1000 ft), configurable
  constant. Applies to both high and low.
- **Day-of-year lookup** must handle leap day (366). Pick a convention and keep it
  consistent between the pipeline and the app.
- Derived data (projections, corrected temps, sun/moon) is **always recomputed**, never
  stored in the persisted plan. Only user intent (dates, pace, gear, swaps) is persisted.

## Conventions

- All temperatures in °F, distances in miles, elevation in feet, precip in inches
  (US hiker units). Keep units in variable names where ambiguous (`...F`, `...Ft`,
  `...In`, `...Mile`).
- Domain logic lives in `src/domain/` as **pure functions** with no React imports.
  UI never does climate math inline — it calls domain functions. This keeps the
  valuable logic testable in isolation.
- Write a Vitest test alongside every domain function before wiring it to UI.

## Commands

```
npm run dev            # start Vite dev server
npm run build          # production build
npm run test           # run Vitest
npm run build:climate  # regenerate src/data/climate.json from ACIS (rarely needed;
                       # normals update ~once a decade)
```

## Gotchas / open questions

- **Normals are computed by us, not taken from ACIS's `normal` flag.** Decision made:
  the pipeline pulls ~30 years of raw daily data and computes day-of-year mean high/low,
  mean precip, freeze probability, and precip probability. This controls the normals
  period (target 1991–2020) and gives the probability fields, which are more useful for
  gear decisions than bare averages. Phase 0 still verifies the ACIS response parses
  cleanly, but the approach is settled.
- The raw ATC centerline has **no elevation**. Trail elevation for waypoints comes from
  a pre-elevated source or a DEM lookup; verify licensing before bundling any dataset.
- Sun/moon are **computed, not fetched** — don't add an API for them.
- Keep the waypoint list small and curated for MVP (~30–40 towns). Do not try to parse
  the full GPS centerline into the app.
