# Phase 0 — Data decisions (normals + elevation)

Spike date: 2026-07-26. This note records the Phase 0 outcomes that gate Phase 2.
The spike script was throwaway (not kept); the real pipeline is `scripts/build-climate.ts`.

## Decision 1 — Climate normals: compute from raw dailies (confirmed)

We pull ~30 years of raw daily `maxt`/`mint`/`pcpn` per station from RCC-ACIS
`StnData` (POST `https://data.rcc-acis.org/StnData`) and compute our own
day-of-year normals: mean high/low, mean precip, freeze probability
(`min ≤ 32°F`), precip probability (measurable, `≥ 0.01 in`).

Verified against HANOVER, NH COOP (`USC00273850`, 584 ft), window
**1991-01-01 → 2020-12-31**: all 10,958 rows returned, response parses as the
documented `[date, maxt, mint, pcpn]` string tuples, and sample normals pass
the sniff test (Jan 15: 29.5/10.2°F, 93% freeze; Jul 15: 82.4/61.4°F, 0% freeze;
Apr 15 still 57% freeze — the gear-planning story in one number).

### Value handling (pipeline must do the same)

- `"M"` (missing) — exclude from that element's stats; never coerce to 0.
- `"T"` (trace) — 0.00 in toward mean precip; does **not** count as a
  measurable-precip day for `precipProbability`.
- Values may carry trailing flags (e.g. `"0.25A"`); `parseFloat` handles them.

### Day-of-year convention: leap-year numbering

Every date maps to the DOY it has in a **leap** year (Mar 1 = 61 always,
Feb 29 = 60). Calendar dates keep stable indices in non-leap years. The
pipeline and `src/domain/dayOfYear()` must both use this convention.

Feb 29 has only ~8 samples in 30 years and is noisy — the pipeline should
blend it with Feb 28 + Mar 1 rather than publish its raw stats.

### Coverage at the test station (and what to check per-station in Phase 2)

- maxt 2.7% missing, mint 2.9%, pcpn 6.4%; no DOY (except Feb 29) below
  25 of 30 possible observations.
- Real `"M"` values occur even at a good station — handling is mandatory.
- **Per-station check for Phase 2:** `StnMeta` `valid_daterange` must span
  1991–2020 for all three elements, and pcpn missingness should stay roughly
  ≤ 10% (large gaps bias `precipProbability` low). West Lebanon / Wilder /
  White River Junction near Hanover all died in 1960 — dead stations near a
  town are common, so always check the range, not just proximity.

## Decision 2 — Trail elevation: USGS 3DEP point queries (confirmed)

Waypoint `trailElevationFt` comes from the **USGS 3DEP Elevation Point Query
Service** (`https://epqs.nationalmap.gov/v1/json?x=<lng>&y=<lat>&units=Feet&wkid=4326`),
queried once per waypoint at curation time — never at runtime, and no DEM is
bundled.

- **Licensing:** US federal public domain. No restriction on storing the
  ~30–40 returned values in `waypoints.json`. This avoids the ATC centerline
  licensing question entirely (we don't ship their data).
- **Accuracy check (1 m 3DEP layer):**
  | Point | EPQS | Published |
  |---|---|---|
  | Springer Mtn, GA (34.6266, -84.1939) | 3,769 ft | 3,782 ft |
  | Clingmans Dome, TN (35.5629, -83.4985) | 6,643 ft | 6,643 ft |
  | Hanover, NH (43.7052, -72.2855) | 594 ft | ~584 ft (station elev) |
- **Caveat:** the service returns elevation at the exact coordinate, so
  waypoint lat/lng must sit **on the trail** (or the summit/town point we
  mean), not the town center a valley below. Curate coordinates with that in
  mind and sanity-check any waypoint whose elevation looks off by > a few
  hundred feet against a topo map.

Station elevations (`stationElevationFt`) come from ACIS `StnMeta` `elev`,
not from EPQS — the lapse correction needs the station's own recorded
elevation.

## Phase 2 addendum — station assignment findings (2026-07-26)

`scripts/assign-stations.ts` assigns each waypoint the nearest station that
(a) spans 1991–2020 in `valid_daterange` for all three elements AND (b) is
≤10% missing per element **within** the window, verified against the actual
daily data. (b) is essential: 17 candidate stations passed (a) but were hollow
inside — Pedlar Dam VA 92% missing temps, Carlisle PA 56% missing everything,
Beltzville Dam PA with zero Jan 1 observations in 30 years.

Known coverage gaps (nearest clean station is far; normals still useful after
lapse correction, but local effects are less represented):

- **Southern VT / Berkshires desert:** Bennington→Glens Falls NY (38 mi),
  Manchester Center→Whitehall NY (32 mi), Mt Greylock→Albany AP (33 mi),
  Dalton→Amherst MA (32 mi). Pittsfield/North Adams airports both have ~20–27%
  holes in the window.
- **100-Mile Wilderness / Katahdin:** Katahdin→Brassua Dam (46 mi);
  Millinocket AP has ~19–25% holes.
- Delaware Water Gap→Allentown AP (28 mi), Glencliff→Hanover (28 mi),
  Bear Mountain→Westchester Co AP (23 mi).
- Blue Marsh Lake PA (Port Clinton) warns at 13.5% pcpn missing in the
  pipeline (vs 10.0% in the screen) because the pipeline also discards
  unparseable multi-day-accumulation codes; accepted as-is.

High-elevation wins: Clingmans Dome→Mt LeConte (6,493 ft), Roan
Highlands→Grandfather Mtn (5,280 ft), Mt Washington→its summit station.

## Phase 0 status

- [x] ACIS spike — parses, M/T handled, normals computed and eyeballed.
- [x] 1991–2020 window confirmed for the test station; per-station checks
      specified for Phase 2.
- [x] Elevation source + licensing confirmed; 3 test points verified.

**Phase 2 is unblocked.**

## Decision 3 — Elevation profile: OSM line + 3DEP samples (spike 2026-09-24)

Goal: elevation between waypoints, for a profile chart and per-leg gain/loss.
The spike script was throwaway; the real pipeline will be `scripts/build-profile.ts`.

**Trail line: OpenStreetMap AT superroute, relation 156553.**
- Fetched with Overpass (send a `User-Agent`, since overpass-api.de returns 406
  without one; fall back to a mirror such as overpass.private.coffee when busy).
  The superroute nests 12 per-state route relations (plus a node and approach
  ways, which we skip).
- Stitching: chain each child relation's untagged/`forward`/`backward` ways by
  nearest endpoint, *then* orient each child chain against the previous end.
  Children are not stored in one direction (the VA relation runs south), so
  per-way flipping alone leaves a ~278 mi false gap. Done right, the line has
  **zero gaps > 0.05 mi** from Springer to Katahdin.
- Stitched length is **2,107 mi vs 2,197.4 official** (~4% short; Maine ~12%
  short). The line is not used for distance: miles come from calibration.
- **Calibration anchors:** only 25 of 44 waypoints lie within 0.5 mi of the
  line. The rest are town coordinates 1–10 mi off-trail (Franklin 9.9, Gatlinburg
  8.0, Hiawassee 7.6, Rangeley 6.6, Killington 6.4 …), so they can't be anchors.
  Kent CT (0.42 mi off) gives inconsistent leg ratios (1.21 then 0.72), so use a
  tighter threshold of ~0.25 mi.
- **License: ODbL.** Credit "© OpenStreetMap contributors" in the app. The
  shipped mile→elevation table is a derivative database and must be offered
  under ODbL. The geometry itself is not shipped.

**Elevations: USGS 3DEP ImageServer `getSamples`** (public domain, the same 3DEP
data as EPQS).
- `POST https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples`
  with an `esriGeometryMultipoint` in WGS84. Values are **meters**; results are
  unordered, so sort by `locationId`. Checked: Springer 1,148.8 m = 3,769 ft,
  Clingmans Dome 2,024.9 m = 6,643 ft, Mt Washington 1,912 m = 6,274 ft
  (matching EPQS).
- Batches must be **contiguous** points: 100 contiguous 0.5 mi samples take
  ~11 s, while 100 points spread along the whole trail time out (504). The full
  trail at 0.5 mi is ~4,400 points, about 44 batches and ~8 min. EPQS
  per-point (~1.2 s/pt at 5 concurrent) would take ~90 min.
- 0.5 mi sampling clips summits (the Smokies' max sample was 6,552 ft vs
  Clingmans' 6,643), so insert each waypoint's exact elevation as a sample.

Fallback if ODbL is unacceptable: the ATC/NPS APPA centerline (ScienceBase,
GPS 1999–2010, no explicit license, citation requested). ATC's GIS Data
Agreement page returned 403, so its terms are unverified.
