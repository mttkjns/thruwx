# ThruWx — Product Requirements

*A weather-and-gear planning tool for Appalachian Trail thru-hikers.*

## 1. Problem & goal

A thru-hike of the Appalachian Trail takes 4–8 months and crosses a wide range of
climates and elevations. The weather a hiker meets changes dramatically over that span,
and the right gear for it is a major factor in both comfort and success. Hikers
currently piece this together from guidebooks, forums, and guesswork.

**Goal:** given a start date and pace, show the hiker the *typical* weather they can
expect at each point along the trail, and help them plan gear changes in advance —
including where along the trail to make each swap.

**Non-goals (MVP):** live/real-time forecasting; pack-weight or base-weight tracking;
full gear-inventory management; social/community features; native mobile apps; SOBO and
flip-flop itineraries.

## 2. Primary user & core story

**User:** a person planning a NOBO (northbound) AT thru-hike, doing their planning at
home or on town wifi — not on-trail. Comfortable with a web app.

**Core story:** "I'm starting at Springer Mountain on March 15th and expect to average
about 15 miles a day. Show me the typical highs, lows, rain, and daylight I'll hit all
the way to Katahdin — corrected for the fact that I'm on ridges, not in the towns. Let
me lay out my gear and tell me roughly where I should switch from my cold kit to my
summer kit and back, so I can mail gear to the right towns at the right time."

## 3. Core concepts (read these first)

1. **Position over time is the engine.** Start date + direction + pace → a projection of
   where the hiker is on any calendar date. Every other feature is a lookup against it.
2. **Normals, not forecasts.** The app shows 30-year historical climate *normals* —
   typical conditions — never a forecast. This is honest about uncertainty and makes the
   entire weather dataset static and precomputable.
3. **Elevation correction is the value.** Weather stations are in valleys/towns; the
   trail is on ridges. Every temperature is corrected for the station→trail elevation
   difference via a lapse rate (~3.5°F / 1,000 ft). Uncorrected trail temps are never
   shown.

The classic NOBO climate arc these produce: **cold → warm → cold** — freezing in the
southern highlands in early spring, hot/humid mid-Atlantic summer, then cold again in
the White Mountains and Maine. The app's job is to make that arc concrete and pin the
gear-swap points to real towns and dates.

## 4. Data sources (all verified)

| Need | Source | Notes |
|------|--------|-------|
| Trail waypoints + trail elevation | Curated list, derived from the ATC centerline (ArcGIS/ScienceBase) plus an elevation source | ATC centerline is 2D (no elevation). Trail elevation for each waypoint comes from a pre-elevated GPX or a DEM lookup — **verify licensing before bundling**. Hand-curate ~30–40 points for MVP. |
| Temp highs/lows, precipitation normals | **RCC-ACIS Web Services v2** — free, keyless JSON API (`data.rcc-acis.org`, `StnData` call) | This is the programmatic backend of the weather.gov/NOWData portal. Fetched at **build time only**. See §7. |
| Sunrise/sunset, day length, moon phase | Computed on-device via `suncalc` | Pure astronomy from date + lat/lng. No API, works offline. |

## 5. Features (MVP)

### 5.1 Trip setup
- Set **start date**.
- Set **pace** as average miles/day (single value for MVP).
- Direction fixed to **NOBO** (mile 0 = Springer Mtn, GA).
- From these, the app computes the projected arrival date at every waypoint.

### 5.2 Weather timeline (the hero view)
- The trip laid out in order (by trail mile / projected date), one row/card per waypoint.
- For each waypoint, show: projected arrival date, **elevation-corrected** normal high &
  low, precipitation normal (and probability of a wet day, if computed), day length and
  sunrise/sunset, and moon phase/illumination.
- Visually convey the cold→warm→cold arc (e.g. a temperature band across the timeline).
- Make the elevation correction visible/explainable (e.g. show station temp vs corrected
  temp, and the elevation delta) so the hiker trusts the number.

### 5.3 Gear planner
- Define **gear items**: name, category (e.g. sleep, insulation, shelter, footwear),
  optional **comfort threshold** (the low temperature at/below which the hiker wants this
  item), and notes.
- Place **gear swaps** at resupply waypoints: which items are added and which are removed
  at that town. Swaps are user-controlled.
- **Optional threshold suggestions:** for any gear item that has a comfort threshold, the
  app suggests the resupply town where a swap should happen — i.e. the last town before
  the projected corrected low first crosses the threshold (or first town after it rises
  back above). Suggestions are advisory; the user accepts, ignores, or overrides them.
  Items without a threshold are managed purely manually.

### 5.4 Persistence & portability
- The plan (dates, pace, gear, swaps) persists locally (localStorage) — no account.
- Export/import the plan as a JSON file so it can be saved or shared.

## 6. Gear-swap suggestion logic

- For each gear item with `comfortThresholdF`:
  - Walk the projected waypoints in trail order.
  - Using the corrected normal **low** at each waypoint, find threshold crossings.
  - A downward crossing (lows dropping to/below threshold) → suggest **adding** the item
    at the last resupply town before the crossing.
  - An upward crossing (lows rising above threshold) → suggest **removing** it at the
    first resupply town after.
- **Flap guard:** a crossing only counts if the new state holds for ≥7 projected
  days (every weather-bearing waypoint in the window agrees). Southern-highland
  normals hover at common thresholds for weeks; without the lag the walk emits
  add/remove/add chains a hiker would never act on.
- Suggestions render distinctly from user-placed swaps and never auto-apply.
- Because a NOBO hiker's lows go down→up→down, expect items like insulation to be
  suggested for removal in the mid-Atlantic summer and re-addition before the northern
  mountains.

## 7. ACIS integration detail (build-time pipeline)

- **Call:** `StnData` at `https://data.rcc-acis.org/StnData` (GET with a `params` JSON,
  or POST). One call per unique station.
- **Elements:** `maxt` (max temp °F), `mint` (min temp °F), `pcpn` (precip inches).
- **Approach (decided): compute normals from raw daily data.** Request ~30 years of
  daily `maxt`/`mint`/`pcpn` (target window 1991–2020) per station, group by day-of-year,
  and compute the mean high, mean low, mean precip, plus **freeze probability** (fraction
  of years with min ≤ 32°F on that day) and **precip probability** (fraction of days with
  measurable precip). This controls the normals period and yields the probability fields,
  which are more decision-useful for gear than bare averages. (The simpler ACIS `normal`
  flag was rejected because its docs describe it as 1981–2010 and it gives no
  probabilities.)
- **Output:** `src/data/climate.json`, keyed by `stationId` → array indexed by
  day-of-year, each entry `{ normalMaxF, normalMinF, normalPrecipIn, freezeProbability?,
  precipProbability? }`.
- Handle ACIS quirks: missing values returned as `"M"`, trace precip as `"T"`.
- This runs rarely (normals change ~once a decade), so it does not need to be fast or
  live.

## 8. Later (post-MVP, explicitly out of scope now)

- SOBO and flip-flop itineraries (same engine, different projection).
- Variable/per-section pace and an early ramp-up curve.
- Interpolating weather between waypoints along the full centerline.
- Overlaying real short-term forecasts onto the near-term slice as the start date nears.
- Pack-weight / base-weight and full gear inventory.
- Accounts and cloud sync.

## 9. Success criteria for MVP

- A user can enter a start date and pace and immediately see a full, ordered,
  elevation-corrected weather timeline from Georgia to Maine.
- The corrected temperatures are visibly different from (and colder than) the raw station
  numbers, and the app can explain why.
- The user can define gear with thresholds and see sensible suggested swap towns that
  match the cold→warm→cold arc, while retaining full manual control.
- The plan survives a page reload and can be exported and re-imported.
