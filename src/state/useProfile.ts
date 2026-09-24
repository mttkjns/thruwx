/**
 * Elevation profile hooks. Like useProjection, everything here is derived
 * from the persisted plan + static data (profile.json) and never stored.
 */
import { useMemo } from "react";
import { hikeLegs, sectionProfile } from "../domain/profile";
import type { Leg, ProfilePoint } from "../domain/profile";
import type { ElevationProfile, WaypointId } from "../domain/types";
import profileJson from "../data/profile.json";
import { usePlanStore } from "./planStore";
import { WAYPOINTS } from "./useProjection";

export const PROFILE = profileJson as ElevationProfile;

/** The plan's whole section, in hike order, with miles hiked from day 0. */
export function useSectionProfile(): ProfilePoint[] {
  const plan = usePlanStore((s) => s.plan);
  return useMemo(() => sectionProfile(plan, WAYPOINTS, PROFILE.samples), [plan]);
}

/** The leg into each waypoint of the section, keyed by waypoint id. */
export function useHikeLegs(): Map<WaypointId, Leg> {
  const plan = usePlanStore((s) => s.plan);
  return useMemo(() => hikeLegs(plan, WAYPOINTS, PROFILE.samples), [plan]);
}
