/**
 * Lapse-rate temperature correction — the core value of the app.
 *
 * Weather stations sit in towns/valleys; the trail rides the ridges. Every
 * displayed trail temperature MUST pass through this correction.
 */

/** °F of cooling per foot of elevation gain (3.5°F / 1,000 ft). */
export const LAPSE_RATE_PER_FT = 0.0035;

/**
 * Correct a station temperature to the trail elevation.
 * Trail above station → colder; below → warmer.
 */
export function correctForElevation(
  stationTempF: number,
  stationElevFt: number,
  trailElevFt: number,
  lapseRatePerFt: number = LAPSE_RATE_PER_FT,
): number {
  return stationTempF - lapseRatePerFt * (trailElevFt - stationElevFt);
}
