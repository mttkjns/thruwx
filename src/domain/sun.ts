/**
 * Sunrise/sunset/day-length and moon phase — computed with suncalc, never fetched.
 */
import { getMoonIllumination, getTimes } from "suncalc";
import { parseIsoDate } from "./dates";
import type { IsoDate, MoonInfo, MoonPhaseName, SunInfo } from "./types";

const PHASE_NAMES: MoonPhaseName[] = [
  "new",
  "waxing-crescent",
  "first-quarter",
  "waxing-gibbous",
  "full",
  "waning-gibbous",
  "last-quarter",
  "waning-crescent",
];

/** Bucket a phase fraction [0..1) into the 8 conventional names. */
export function moonPhaseName(phase: number): MoonPhaseName {
  return PHASE_NAMES[Math.round(phase * 8) % 8];
}

/**
 * Sun and moon facts for a calendar date at a point. Evaluated at 12:00 UTC —
 * morning local time anywhere on the AT — so the whole local day's times
 * belong to the requested date.
 */
export function sunAndMoon(
  date: IsoDate,
  lat: number,
  lng: number,
): { sun: SunInfo; moon: MoonInfo } {
  const noonUtc = new Date(parseIsoDate(date).getTime() + 12 * 3600 * 1000);

  const times = getTimes(noonUtc, lat, lng);
  const { sunrise, sunset } = times;
  if (!sunrise || !sunset) {
    // Only possible at polar latitudes; the AT spans ~34°N–46°N.
    throw new Error(`No sunrise/sunset for ${date} at ${lat},${lng}`);
  }
  const sun: SunInfo = {
    sunrise: sunrise.toISOString(),
    sunset: sunset.toISOString(),
    dayLengthHours: (sunset.getTime() - sunrise.getTime()) / 3_600_000,
  };

  const illum = getMoonIllumination(noonUtc);
  const moon: MoonInfo = {
    phase: illum.phase,
    illumination: illum.fraction,
    phaseName: moonPhaseName(illum.phase),
  };

  return { sun, moon };
}
