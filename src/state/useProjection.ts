/**
 * Derived projection — the ONLY way UI should obtain projections. Recomputed
 * (memoized) from the persisted plan + static data; never stored anywhere.
 *
 * Before the climate data is loaded (see climateStore), the projection is
 * built against an empty ClimateData: schedule, sun, and moon are complete,
 * every waypoint's weather is null, and there are no swap suggestions.
 */
import { useMemo } from "react";
import { buildProjection } from "../domain/projection";
import type { ClimateData, Projection, Waypoint } from "../domain/types";
import waypointsJson from "../data/waypoints.json";
import { useClimateStore } from "./climateStore";
import { usePlanStore } from "./planStore";

export const WAYPOINTS = waypointsJson as Waypoint[];

const NO_CLIMATE: ClimateData = {};

export function useProjection(): Projection {
  const plan = usePlanStore((s) => s.plan);
  const climate = useClimateStore((s) => s.climate);
  return useMemo(
    () => buildProjection(plan, WAYPOINTS, climate ?? NO_CLIMATE),
    [plan, climate],
  );
}
