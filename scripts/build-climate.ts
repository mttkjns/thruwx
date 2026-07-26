/**
 * Climate pipeline — generates src/data/climate.json from RCC-ACIS.
 *
 * Phase 2 will implement this per docs/PHASE0_DATA_NOTES.md: for each unique
 * stationId in src/data/waypoints.json, pull 1991–2020 daily maxt/mint/pcpn
 * from StnData and compute per-day-of-year normals ("M" excluded, "T" = 0.00 in
 * and not a measurable-precip day, leap-layout indexing per DayOfYearIndex).
 *
 * Stub for now so `npm run build:climate` is wired.
 */
console.error(
  "build-climate: not implemented yet (Phase 2). See docs/BUILD_PLAN.md and docs/PHASE0_DATA_NOTES.md.",
);
process.exit(1);
