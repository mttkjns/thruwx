# Ridgeline

Weather + gear planning for Appalachian Trail thru-hikers.

Given a start date, direction (NOBO), and pace, Ridgeline projects where you'll
be on every date of a 4–8 month hike and shows the **typical weather** you can
expect there — 1991–2020 historical climate normals, corrected from each
weather station's elevation to the trail's elevation (~3.5°F colder per
1,000 ft of ridge above the valley station). Daylight, moon phase, and
threshold-based gear-swap suggestions ride along.

**These are historical typical conditions, not a forecast.** Nobody can
forecast a date four months out; normals are the honest planning number.

## Architecture

No backend. No runtime API calls. No accounts.

```
Build time:  scripts/build-climate.ts  --ACIS-->  src/data/climate.json
Static data: src/data/waypoints.json   (hand-curated, 44 waypoints)
Runtime:     React SPA, all math in-browser, plan persists to localStorage.
```

The climate dataset is static because normals change once a decade. The React
app loads two JSON files and computes everything else (projection, elevation
correction, sun/moon, suggestions) as pure functions in `src/domain/`.

## Commands

```
npm run dev            # Vite dev server
npm run build          # production build → dist/
npm run test           # Vitest (domain logic + data validation)
npm run build:climate  # regenerate climate.json from RCC-ACIS (rarely needed)
npx tsx scripts/assign-stations.ts   # re-assign ACIS stations to waypoints
```

## Deploying

`npm run build` produces a fully static `dist/` — any static host works,
zero config (single-page, no client-side routing, no rewrites needed):

- **Netlify / Vercel / Cloudflare Pages**: connect the repo; build command
  `npm run build`, output directory `dist`.
- **Anything else**: copy `dist/` to the web root.

## Data notes

See `docs/PHASE0_DATA_NOTES.md` for the full data decisions: the normals
methodology (computed from ~30 years of raw ACIS dailies, "M"/"T" handling,
leap-day convention), station-assignment rules (stations must be ≤10% missing
within 1991–2020 — period-of-record alone lies), known station-coverage gaps
(southern Vermont, the 100-Mile Wilderness), and elevation sourcing (USGS 3DEP,
public domain).

Weather data: NOAA, via RCC-ACIS web services. Elevations: USGS 3DEP.
