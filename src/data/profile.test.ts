import { describe, expect, it } from "vitest";
import { elevationAtMile } from "../domain/profile";
import type { ElevationProfile, Waypoint } from "../domain/types";
import profileJson from "./profile.json";
import waypointsJson from "./waypoints.json";

const profile = profileJson as ElevationProfile;
const waypoints: Waypoint[] = waypointsJson;
const samples = profile.samples;

describe("profile.json", () => {
  it("credits OSM and carries its license", () => {
    expect(profile.license).toBe("ODbL-1.0");
    expect(profile.source).toMatch(/OpenStreetMap/);
  });

  it("spans Springer to Katahdin", () => {
    expect(samples[0][0]).toBe(0);
    expect(samples[samples.length - 1][0]).toBe(waypoints[waypoints.length - 1].trailMile);
  });

  it("is strictly increasing by mile with no gap over 1 mile", () => {
    for (let i = 1; i < samples.length; i++) {
      const gap = samples[i][0] - samples[i - 1][0];
      expect(gap, `after mile ${samples[i - 1][0]}`).toBeGreaterThan(0);
      expect(gap, `after mile ${samples[i - 1][0]}`).toBeLessThanOrEqual(1);
    }
  });

  it("agrees with every waypoint's trailElevationFt", () => {
    for (const w of waypoints) {
      expect(elevationAtMile(samples, w.trailMile), w.id).toBe(w.trailElevationFt);
    }
  });

  it("has plausible AT elevations", () => {
    for (const [mile, ft] of samples) {
      expect(ft, `mile ${mile}`).toBeGreaterThan(0);
      expect(ft, `mile ${mile}`).toBeLessThan(6700); // Clingmans Dome, 6,643 ft
    }
  });
});
