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
 * Arrival date per waypoint: startDate + floor(trailMile / paceMilesPerDay).
 * Floor, not round — reaching mile 31.7 at 15 mi/day happens during day 2
 * (0-based), even though 31.7/15 ≈ 2.11.
 */
export function projectSchedule(plan: TripPlan, waypoints: Waypoint[]): ScheduleEntry[] {
  if (!(plan.paceMilesPerDay > 0)) {
    throw new Error(`paceMilesPerDay must be positive, got ${plan.paceMilesPerDay}`);
  }
  return waypoints.map((wp) => {
    const dayOfHike = Math.floor(wp.trailMile / plan.paceMilesPerDay);
    return {
      waypointId: wp.id,
      arrivalDate: addDays(plan.startDate, dayOfHike),
      dayOfHike,
    };
  });
}
