/**
 * Date helpers for the domain layer. All dates are IsoDate strings ("YYYY-MM-DD")
 * handled in UTC — never construct `new Date("YYYY-MM-DD")` in local time, that
 * shifts a day west of Greenwich.
 */
import type { DayOfYearIndex, IsoDate } from "./types";

/** Cumulative days before each month in a leap year. */
const CUM_DAYS_LEAP = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/** Parse an IsoDate to a Date at UTC midnight. */
export function parseIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** startDate plus a whole number of days (may be negative). */
export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

/**
 * Map a calendar date to the 0-based leap-layout index used by climate.json
 * (see DayOfYearIndex in types.ts): every date gets the index it has in a
 * LEAP year, so Feb 29 = 59 and Mar 1 = 60 in every year. This must match
 * the pipeline's leapIndex() in scripts/build-climate.ts exactly.
 */
export function dayOfYearIndex(iso: IsoDate): DayOfYearIndex {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return CUM_DAYS_LEAP[month - 1] + day - 1;
}
