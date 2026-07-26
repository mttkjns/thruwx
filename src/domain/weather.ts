/**
 * Climate lookup + elevation correction for one waypoint on one date.
 */
import { dayOfYearIndex } from "./dates";
import { correctForElevation } from "./elevation";
import type { ClimateData, IsoDate, Waypoint, WaypointWeather } from "./types";

/**
 * Corrected normals for arriving at `waypoint` on `arrivalDate`.
 * Returns null when the waypoint has no assigned station (or the station is
 * missing from the climate data) — the UI shows "no data" rather than an
 * uncorrected number. NEVER fall back to raw station temps.
 */
export function weatherAtWaypoint(
  waypoint: Waypoint,
  arrivalDate: IsoDate,
  climate: ClimateData,
): WaypointWeather | null {
  const { stationId, stationElevationFt, trailElevationFt } = waypoint;
  if (stationId === null || stationElevationFt === null) return null;
  const normals = climate[stationId];
  if (!normals) return null;

  const day = normals[dayOfYearIndex(arrivalDate)];
  return {
    stationMaxF: day.normalMaxF,
    stationMinF: day.normalMinF,
    correctedMaxF: correctForElevation(day.normalMaxF, stationElevationFt, trailElevationFt),
    correctedMinF: correctForElevation(day.normalMinF, stationElevationFt, trailElevationFt),
    elevationDeltaFt: trailElevationFt - stationElevationFt,
    precipIn: day.normalPrecipIn,
    freezeProbability: day.freezeProbability,
    precipProbability: day.precipProbability,
  };
}
