/**
 * Position-over-time projection — the engine everything else hangs off.
 */
import { addDays } from "./dates";
import type { IsoDate, TripPlan, Waypoint, WaypointId } from "./types";

export interface ScheduleEntry {
  waypointId: WaypointId;
  arrivalDate: IsoDate;
  /** Whole days since startDate (0 = arriving during the first day). */
  dayOfHike: number;
}

/**
 * Arrival date per waypoint, returned in HIKE order (NOBO: ascending trail
 * mile; SOBO: descending — the hike starts at Katahdin and trailMile keeps
 * its NOBO meaning, so miles hiked = maxMile − trailMile).
 *
 * dayOfHike = floor(milesHiked / paceMilesPerDay). Floor, not round —
 * reaching mile 31.7 at 15 mi/day happens during day 2 (0-based), even
 * though 31.7/15 ≈ 2.11.
 */
export function projectSchedule(plan: TripPlan, waypoints: Waypoint[]): ScheduleEntry[] {
  if (!(plan.paceMilesPerDay > 0)) {
    throw new Error(`paceMilesPerDay must be positive, got ${plan.paceMilesPerDay}`);
  }
  const sobo = plan.direction === "SOBO";
  const maxMile = Math.max(...waypoints.map((w) => w.trailMile));
  const ordered = [...waypoints].sort((a, b) =>
    sobo ? b.trailMile - a.trailMile : a.trailMile - b.trailMile,
  );
  return ordered.map((wp) => {
    const milesHiked = sobo ? maxMile - wp.trailMile : wp.trailMile;
    const dayOfHike = Math.floor(milesHiked / plan.paceMilesPerDay);
    return {
      waypointId: wp.id,
      arrivalDate: addDays(plan.startDate, dayOfHike),
      dayOfHike,
    };
  });
}
