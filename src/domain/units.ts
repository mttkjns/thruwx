/**
 * Temperature display units. Everything in the domain, the data, and the
 * persisted plan stays in °F; °C exists only at the display/input edge
 * (see useTempFormat in src/components/format.ts).
 */
import { LAPSE_RATE_PER_FT } from "./elevation";

export type TempUnit = "F" | "C";

export function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

/** A °F value in the chosen unit. */
export function toUnit(f: number, unit: TempUnit): number {
  return unit === "C" ? fToC(f) : f;
}

/** A value typed in the chosen unit, back to °F for storage. */
export function fromUnit(value: number, unit: TempUnit): number {
  return unit === "C" ? cToF(value) : value;
}

/**
 * The lapse rate per 1,000 ft in the chosen unit, for explanatory text.
 * A temperature DIFFERENCE converts by 5/9 only (no 32°F offset).
 */
export function lapsePer1000Ft(unit: TempUnit): number {
  const perThousandF = LAPSE_RATE_PER_FT * 1000;
  return unit === "C" ? (perThousandF * 5) / 9 : perThousandF;
}
