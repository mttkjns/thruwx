# ThruWx — Build Plan

A phased plan for building the MVP with Claude Code. Each phase ends in something
runnable or verifiable. Do the risky, uncertain work first (Phase 0) before committing
to the rest. Read `../CLAUDE.md` and `PRD.md` before starting.

Guiding rule: **domain logic before UI.** The valuable, tricky parts (projection,
elevation correction, threshold detection) are pure functions — build and test those in
isolation, then put a UI on top.

---

## Phase 0 — De-risk the data (do this first, it gates everything)

The two genuinely uncertain things are the climate normals and the trail elevation. Spike
both before building around them.

- [ ] **ACIS spike.** Pick one real AT-adjacent station (e.g. near Hot Springs NC or
      Hanover NH). From a throwaway script, pull ~30 years of daily `maxt`/`mint`/`pcpn`
      and compute day-of-year mean high/low, mean precip, freeze probability, and precip
      probability (the settled approach — see PRD §7). Confirm the response parses, and
      that `"M"` (missing) and `"T"` (trace) values are handled.
- [ ] **Confirm the normals window** (target 1991–2020) is available for the test station
      and record any station-coverage gaps in a short `docs/` note.
- [ ] **Elevation spike.** Confirm a source of trail elevation for waypoints (pre-elevated
      GPX vs DEM lookup) and its licensing. Get elevation for 2–3 test waypoints.
- [ ] **Deliverable:** a documented decision on normals + elevation, and a throwaway
      script proving an ACIS response can be parsed into `{ dayOfYear, maxF, minF,
      precipIn }`.

**Do not proceed to Phase 2+ until the normals approach is decided.**

---

## Phase 1 — Project scaffold

- [ ] Vite + React + TypeScript project. Add Tailwind, Zustand, suncalc, Vitest.
- [ ] Folder structure:
      ```
      src/
        domain/      # pure logic + types (no React)
        data/        # waypoints.json, climate.json (generated)
        state/       # Zustand store (persisted plan)
        components/  # UI
        views/       # top-level screens
      scripts/
        build-climate.ts
      docs/
      ```
- [ ] Wire `npm run dev|build|test|build:climate` (see CLAUDE.md).
- [ ] Commit `types.ts` for the domain model in PRD §Domain (Waypoint, DailyNormal,
      TripPlan, GearItem, GearSwap, Projection).

---

## Phase 2 — Static data

- [ ] **Curate `waypoints.json`:** ~30–40 major NOBO resupply towns, each with `id`,
      `name`, `trailMile`, `lat`, `lng`, `trailElevationFt`, `isResupply`, plus the
      assigned ACIS `stationId` and `stationElevationFt` (use `StnMeta` to find each
      town's nearest suitable station and its elevation). Order by `trailMile` from
      Springer (0) northward.
- [ ] **Build the climate pipeline** (`scripts/build-climate.ts`) using the Phase 0
      decision: for each unique `stationId` in waypoints.json, fetch and produce the
      per-day normals, write `src/data/climate.json`. Handle `"M"`/`"T"` values.
- [ ] Sanity-check the output: southern-highland stations should show freezing spring
      lows; mid-Atlantic should show hot summers.

---

## Phase 3 — Domain logic (pure functions + tests)

Build each with a Vitest test before moving on. No React in this layer.

- [ ] `projectSchedule(plan, waypoints)` → arrival date per waypoint
      (`startDate + trailMile / paceMilesPerDay`).
- [ ] `correctForElevation(stationTempF, stationElevFt, trailElevFt)` using
      `LAPSE_RATE_PER_FT = 0.0035`. Test with a known delta (e.g. +3000 ft ≈ -10.5°F).
- [ ] `dayOfYear(date)` with explicit leap-day handling, consistent with the pipeline.
- [ ] `weatherAtWaypoint(waypoint, arrivalDate, climate)` → corrected high/low, precip,
      probabilities.
- [ ] `sunAndMoon(date, lat, lng)` via suncalc → sunrise, sunset, day length, moon phase
      + illumination.
- [ ] `suggestSwaps(plan, projection)` → threshold-crossing suggestions per PRD §6, for
      gear items that have a `comfortThresholdF`. Test the down-crossing and up-crossing
      cases explicitly.
- [ ] `buildProjection(plan, waypoints, climate)` composing the above into the derived
      `Projection` object the UI consumes.

---

## Phase 4 — State

- [ ] Zustand store holding `TripPlan`, with `persist` → localStorage.
- [ ] Actions: set start date, set pace, add/edit/remove gear item, add/edit/remove swap.
- [ ] Projection is derived (selector/memo), **never** persisted.
- [ ] Export plan → JSON download; import plan → validate and load.

---

## Phase 5 — UI

- [ ] **Trip setup**: start date + pace inputs.
- [ ] **Weather timeline (hero view)**: ordered waypoint cards/rows showing arrival date,
      corrected high/low, precip (+ probability), day length/sun times, moon phase.
      Convey the cold→warm→cold arc visually. Make the elevation correction inspectable
      (station vs corrected temp + elevation delta).
- [ ] **Gear planner**: manage gear items (with optional threshold); place swaps at
      resupply towns; show suggested swaps distinctly from user-placed ones, with
      accept/ignore/override.
- [ ] Responsive layout (planning happens on laptop and phone at town wifi).

---

## Phase 6 — Polish & ship

- [ ] Empty/first-run state that guides the user to enter a start date.
- [ ] Guardrails on inputs (plausible pace, valid dates).
- [ ] A clear, honest "these are historical typical conditions, not a forecast" note.
- [ ] Deploy as a static site (Vercel/Netlify/Cloudflare Pages).

---

## Test focus

Concentrate automated tests on the domain layer — projection dates, elevation correction,
day-of-year/leap handling, and swap-threshold crossings. These are pure, high-value, and
easy to get subtly wrong. UI can be verified manually for MVP.
