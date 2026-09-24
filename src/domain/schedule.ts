/**
 * Position-over-time projection — the engine everything else hangs off.
 */
import { addDays } from "./dates";
import { hikeSection, sectionStartMile } from "./section";
import type { IsoDate, TripPlan, Waypoint, WaypointId } from "./types";

export interface ScheduleEntry {
  waypointId: WaypointId;
  arrivalDate: IsoDate;
  /** Whole days since startDate (0 = arriving during the first day). */
  dayOfHike: number;
}

/**
 * Arrival date per waypoint in the plan's section (see hikeSection), returned
 * in HIKE order (NOBO: ascending trail mile; SOBO: descending — trailMile
 * keeps its NOBO meaning, so miles hiked = |trailMile − startMile|; for a
 * full SOBO hike that is maxMile − trailMile).
 *
 * dayOfHike = floor(milesHiked / paceMilesPerDay). Floor, not round —
 * reaching mile 31.7 at 15 mi/day happens during day 2 (0-based), even
 * though 31.7/15 ≈ 2.11.
 */
export function projectSchedule(plan: TripPlan, waypoints: Waypoint[]): ScheduleEntry[] {
  if (!(plan.paceMilesPerDay > 0)) {
    throw new Error(`paceMilesPerDay must be positive, got ${plan.paceMilesPerDay}`);
  }
  const section = hikeSection(plan, waypoints);
  const startMile = sectionStartMile(plan, section);
  return section.map((wp) => {
    const milesHiked = Math.abs(wp.trailMile - startMile);
    const dayOfHike = Math.floor(milesHiked / plan.paceMilesPerDay);
    return {
      waypointId: wp.id,
      arrivalDate: addDays(plan.startDate, dayOfHike),
      dayOfHike,
    };
  });
}
