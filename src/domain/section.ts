/**
 * Section hikes: which waypoints the plan actually covers, in hike order.
 */
import type { TripPlan, Waypoint } from "./types";

/** All waypoints in HIKE order: ascending trail mile for NOBO, descending for SOBO. */
export function hikeOrder(direction: TripPlan["direction"], waypoints: Waypoint[]): Waypoint[] {
  const sobo = direction === "SOBO";
  return [...waypoints].sort((a, b) =>
    sobo ? b.trailMile - a.trailMile : a.trailMile - b.trailMile,
  );
}

/**
 * The plan's waypoints from start to end inclusive, in hike order. A missing
 * or unknown start falls back to the first waypoint in hike order and a
 * missing or unknown end to the last. An end at or behind the start also
 * falls back to the last, so the section always has at least one waypoint
 * and never runs backward.
 */
export function hikeSection(plan: TripPlan, waypoints: Waypoint[]): Waypoint[] {
  const ordered = hikeOrder(plan.direction, waypoints);
  const found = (id: string | undefined) =>
    id === undefined ? -1 : ordered.findIndex((w) => w.id === id);

  const start = Math.max(found(plan.startWaypointId), 0);
  let end = found(plan.endWaypointId);
  if (end <= start) end = ordered.length - 1;
  return ordered.slice(start, end + 1);
}

/**
 * Trail mile where the hike begins (day 0, zero miles hiked). A chosen start
 * waypoint is day 0. Without one, a NOBO hike starts at Springer (mile 0 by
 * definition) and a SOBO hike at the highest mile, which is where hikeSection
 * already begins.
 */
export function sectionStartMile(plan: TripPlan, section: Waypoint[]): number {
  const chosenStart = section[0].id === plan.startWaypointId;
  return chosenStart || plan.direction === "SOBO" ? section[0].trailMile : 0;
}
