/**
 * Elevation profile along the hike: the trail between waypoints, per-leg
 * gain/loss, and the whole section placed on the hike's day axis.
 *
 * Profile samples are [trailMile, elevationFt] in ascending NOBO mile (see
 * ElevationProfile). Everything returned here is in HIKE order, so SOBO legs
 * run from high mile to low mile and their gain/loss swap relative to NOBO.
 */
import { hikeSection, sectionStartMile } from "./section";
import type { TripPlan, Waypoint, WaypointId } from "./types";

/** Climbs/descents smaller than this are treated as DEM noise, not terrain. */
export const GAIN_NOISE_FT = 20;

export interface ProfilePoint {
  trailMile: number;
  elevationFt: number;
  /** Miles from the start of the hike (section), 0 at day 0. */
  milesHiked: number;
}

export interface Leg {
  /** Null when the hike starts before the first waypoint of the section. */
  fromWaypointId: WaypointId | null;
  toWaypointId: WaypointId;
  distanceMi: number;
  gainFt: number;
  lossFt: number;
  /** Profile from → to in hike order, endpoints included. */
  points: ProfilePoint[];
}

/** Elevation at any trail mile, linearly interpolated (clamped at the ends). */
export function elevationAtMile(samples: [number, number][], mile: number): number {
  if (samples.length === 0) throw new Error("empty elevation profile");
  if (mile <= samples[0][0]) return samples[0][1];
  const last = samples[samples.length - 1];
  if (mile >= last[0]) return last[1];
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] <= mile) lo = mid;
    else hi = mid;
  }
  const [m0, e0] = samples[lo];
  const [m1, e1] = samples[hi];
  return e0 + ((mile - m0) / (m1 - m0)) * (e1 - e0);
}

/**
 * Profile between two trail miles in the order given (fromMile > toMile walks
 * SOBO), with interpolated endpoints. `startMile` sets milesHiked = 0.
 */
export function profileBetween(
  samples: [number, number][],
  fromMile: number,
  toMile: number,
  startMile: number = fromMile,
): ProfilePoint[] {
  const lo = Math.min(fromMile, toMile);
  const hi = Math.max(fromMile, toMile);
  const miles = [lo, ...samples.map(([m]) => m).filter((m) => m > lo && m < hi), hi];
  if (fromMile > toMile) miles.reverse();
  if (lo === hi) miles.length = 1;
  return miles.map((m) => ({
    trailMile: m,
    elevationFt: elevationAtMile(samples, m),
    milesHiked: Math.abs(m - startMile),
  }));
}

/**
 * Total climb and descent over a profile in walking order. Uses hysteresis:
 * a change only counts once the elevation has moved `noiseFt` from the last
 * turning point, so sample jitter on flat ground doesn't add up to phantom
 * climbing.
 */
export function gainLossFt(
  elevationsFt: number[],
  noiseFt: number = GAIN_NOISE_FT,
): { gainFt: number; lossFt: number } {
  let gainFt = 0;
  let lossFt = 0;
  if (elevationsFt.length === 0) return { gainFt, lossFt };
  let ref = elevationsFt[0];
  for (const e of elevationsFt.slice(1)) {
    const d = e - ref;
    if (d >= noiseFt) {
      gainFt += d;
      ref = e;
    } else if (d <= -noiseFt) {
      lossFt -= d;
      ref = e;
    }
  }
  // Count the residual to the endpoint so gain − loss = net change exactly.
  const last = elevationsFt[elevationsFt.length - 1];
  if (last > ref) gainFt += last - ref;
  else lossFt += ref - last;
  return { gainFt, lossFt };
}

/** The whole section's profile, in hike order, with milesHiked from day 0. */
export function sectionProfile(
  plan: TripPlan,
  waypoints: Waypoint[],
  samples: [number, number][],
): ProfilePoint[] {
  const section = hikeSection(plan, waypoints);
  const startMile = sectionStartMile(plan, section);
  return profileBetween(samples, startMile, section[section.length - 1].trailMile, startMile);
}

/**
 * The leg INTO each waypoint of the section, keyed by that waypoint's id.
 * The section's first waypoint has no leg (nothing walked yet) unless the
 * hike starts before it (full NOBO hike without a Springer waypoint).
 */
export function hikeLegs(
  plan: TripPlan,
  waypoints: Waypoint[],
  samples: [number, number][],
): Map<WaypointId, Leg> {
  const section = hikeSection(plan, waypoints);
  const startMile = sectionStartMile(plan, section);
  const legs = new Map<WaypointId, Leg>();
  let prevMile = startMile;
  let prevId: WaypointId | null = null;
  for (const wp of section) {
    if (wp.trailMile !== prevMile) {
      const points = profileBetween(samples, prevMile, wp.trailMile, startMile);
      legs.set(wp.id, {
        fromWaypointId: prevId,
        toWaypointId: wp.id,
        distanceMi: Math.abs(wp.trailMile - prevMile),
        ...gainLossFt(points.map((p) => p.elevationFt)),
        points,
      });
    }
    prevMile = wp.trailMile;
    prevId = wp.id;
  }
  return legs;
}
