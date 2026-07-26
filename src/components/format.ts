/**
 * Display-only formatting helpers. No climate math here — that lives in
 * src/domain and arrives via the projection.
 */
import type { MoonPhaseName } from "../domain/types";

export function fmtTemp(f: number): string {
  return `${Math.round(f)}°`;
}

/** "Mar 14" — parse as UTC and format as UTC so the date never shifts. */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The whole AT lives in Eastern time; pin sun times to it. */
export function fmtTimeET(isoInstant: string): string {
  return new Date(isoInstant)
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    })
    .toLowerCase();
}

/** "≈4.8 months" from a day count (mean month = 30.44 days). */
export function fmtApproxMonths(days: number): string {
  const months = days / 30.44;
  const rounded = Math.round(months * 10) / 10;
  return `≈${rounded} ${rounded === 1 ? "month" : "months"}`;
}

export function fmtDayLength(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export const MOON_EMOJI: Record<MoonPhaseName, string> = {
  "new": "🌑",
  "waxing-crescent": "🌒",
  "first-quarter": "🌓",
  "waxing-gibbous": "🌔",
  "full": "🌕",
  "waning-gibbous": "🌖",
  "last-quarter": "🌗",
  "waning-crescent": "🌘",
};

export function moonLabel(phaseName: MoonPhaseName): string {
  return phaseName.replace("-", " ");
}

/**
 * Map °F to a hue: deep blue at ≤ 10, red at ≥ 70. The compressed domain
 * spans the lows a thru-hiker actually meets, so the cold→warm→cold arc is
 * visible in the colors (a full -10..100 ramp parks every spring low at an
 * indistinguishable green).
 */
export function tempColor(f: number): string {
  const t = Math.min(1, Math.max(0, (f - 10) / 60));
  const hue = 230 - 220 * t;
  return `hsl(${hue.toFixed(0)} 75% 52%)`;
}
