/**
 * buildProjection — composes schedule, weather, sun/moon, and swap suggestions
 * into the single derived Projection the UI consumes. Recomputed on every plan
 * change; never persisted.
 */
import { projectSchedule } from "./schedule";
import { sunAndMoon } from "./sun";
import { suggestSwaps } from "./swaps";
import { weatherAtWaypoint } from "./weather";
import type {
  ClimateData,
  Projection,
  TripPlan,
  Waypoint,
  WaypointProjection,
} from "./types";

export function buildProjection(
  plan: TripPlan,
  waypoints: Waypoint[],
  climate: ClimateData,
): Projection {
  if (waypoints.length === 0) {
    throw new Error("buildProjection requires at least one waypoint");
  }

  const schedule = projectSchedule(plan, waypoints);
  const projectedWaypoints: WaypointProjection[] = waypoints.map((wp, i) => {
    const { arrivalDate, dayOfHike } = schedule[i];
    const { sun, moon } = sunAndMoon(arrivalDate, wp.lat, wp.lng);
    return {
      waypointId: wp.id,
      arrivalDate,
      dayOfHike,
      weather: weatherAtWaypoint(wp, arrivalDate, climate),
      sun,
      moon,
    };
  });

  const last = schedule[schedule.length - 1];
  return {
    waypoints: projectedWaypoints,
    suggestedSwaps: suggestSwaps(plan, projectedWaypoints, waypoints),
    finishDate: last.arrivalDate,
    totalDays: last.dayOfHike,
  };
}
