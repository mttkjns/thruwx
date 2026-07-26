import { describe, expect, it } from "vitest";
import type { Waypoint } from "../domain/types";
import waypointsJson from "./waypoints.json";

// Typing the import verifies the JSON stays assignable to the domain shape.
const waypoints: Waypoint[] = waypointsJson;

describe("waypoints.json", () => {
  it("is non-empty and starts at Springer (mile 0)", () => {
    expect(waypoints.length).toBeGreaterThan(0);
    expect(waypoints[0].trailMile).toBe(0);
  });

  it("is strictly increasing by trailMile (NOBO order)", () => {
    for (let i = 1; i < waypoints.length; i++) {
      expect(
        waypoints[i].trailMile,
        `${waypoints[i - 1].id} → ${waypoints[i].id}`,
      ).toBeGreaterThan(waypoints[i - 1].trailMile);
    }
  });

  it("has unique ids", () => {
    const ids = waypoints.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has plausible coordinates and elevations for the AT", () => {
    for (const w of waypoints) {
      expect(w.lat, w.id).toBeGreaterThan(33);
      expect(w.lat, w.id).toBeLessThan(46.5);
      expect(w.lng, w.id).toBeGreaterThan(-85);
      expect(w.lng, w.id).toBeLessThan(-68);
      expect(w.trailElevationFt, w.id).toBeGreaterThan(0);
      expect(w.trailElevationFt, w.id).toBeLessThan(6700);
    }
  });
});
