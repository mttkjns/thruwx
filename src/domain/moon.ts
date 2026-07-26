/**
 * Full-moon dates within a hike window — computed with suncalc, never fetched.
 * suncalc's phase runs 0→1 (new → full at 0.5 → new); a full moon falls on the
 * day the phase crosses 0.5. Evaluated at 12:00 UTC like the rest of sun.ts.
 */
import { getMoonIllumination } from "suncalc";
import { addDays, parseIsoDate } from "./dates";
import type { IsoDate } from "./types";

function phaseAt(date: IsoDate): number {
  return getMoonIllumination(new Date(parseIsoDate(date).getTime() + 12 * 3600 * 1000))
    .phase;
}

/** Dates of every full moon in [startDate, startDate + totalDays]. */
export function fullMoonDates(startDate: IsoDate, totalDays: number): IsoDate[] {
  const out: IsoDate[] = [];
  let prev = phaseAt(startDate);
  for (let d = 1; d <= totalDays; d++) {
    const date = addDays(startDate, d);
    const cur = phaseAt(date);
    if (prev < 0.5 && cur >= 0.5) {
      out.push(
        Math.abs(prev - 0.5) <= Math.abs(cur - 0.5) ? addDays(startDate, d - 1) : date,
      );
    }
    prev = cur;
  }
  return out;
}
