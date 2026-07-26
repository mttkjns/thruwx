/**
 * Derived projection — the ONLY way UI should obtain projections. Recomputed
 * (memoized) from the persisted plan + static data; never stored anywhere.
 */
import { useMemo } from "react";
import { buildProjection } from "../domain/projection";
import type { ClimateData, Projection, Waypoint } from "../domain/types";
import climateJson from "../data/climate.json";
import waypointsJson from "../data/waypoints.json";
import { usePlanStore } from "./planStore";

export const WAYPOINTS = waypointsJson as Waypoint[];
export const CLIMATE = climateJson as ClimateData;

export function useProjection(): Projection {
  const plan = usePlanStore((s) => s.plan);
  return useMemo(() => buildProjection(plan, WAYPOINTS, CLIMATE), [plan]);
}
