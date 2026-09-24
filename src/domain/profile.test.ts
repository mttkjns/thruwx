import { describe, expect, it } from "vitest";
import {
  elevationAtMile,
  gainLossFt,
  hikeLegs,
  profileBetween,
  sectionProfile,
} from "./profile";
import type { TripPlan, Waypoint } from "./types";

const wp = (id: string, trailMile: number): Waypoint => ({
  id,
  name: id,
  state: "GA",
  trailMile,
  lat: 34.6,
  lng: -84.2,
  trailElevationFt: 3000,
  isResupply: true,
  stationId: null,
  stationElevationFt: null,
});

const plan = (over: Partial<TripPlan> = {}): TripPlan => ({
  schemaVersion: 1,
  startDate: "2027-03-01",
  direction: "NOBO",
  paceMilesPerDay: 10,
  gear: [],
  swaps: [],
  ...over,
});

// A 20-mile trail: climb 0→5 (1000→3000), descend to 10 (2000), climb to 20 (4000).
const SAMPLES: [number, number][] = [
  [0, 1000],
  [5, 3000],
  [10, 2000],
  [15, 3000],
  [20, 4000],
];
const WAYPOINTS = [wp("a", 0), wp("b", 10), wp("c", 20)];

describe("elevationAtMile", () => {
  it("returns exact samples and interpolates between them", () => {
    expect(elevationAtMile(SAMPLES, 5)).toBe(3000);
    expect(elevationAtMile(SAMPLES, 2.5)).toBe(2000);
    expect(elevationAtMile(SAMPLES, 12.5)).toBe(2500);
  });

  it("clamps outside the profile", () => {
    expect(elevationAtMile(SAMPLES, -3)).toBe(1000);
    expect(elevationAtMile(SAMPLES, 99)).toBe(4000);
  });
});

describe("profileBetween", () => {
  it("includes interpolated endpoints and interior samples, NOBO order", () => {
    const pts = profileBetween(SAMPLES, 2.5, 12.5);
    expect(pts.map((p) => p.trailMile)).toEqual([2.5, 5, 10, 12.5]);
    expect(pts.map((p) => p.elevationFt)).toEqual([2000, 3000, 2000, 2500]);
    expect(pts.map((p) => p.milesHiked)).toEqual([0, 2.5, 7.5, 10]);
  });

  it("walks backward for SOBO (from > to)", () => {
    const pts = profileBetween(SAMPLES, 20, 10, 20);
    expect(pts.map((p) => p.trailMile)).toEqual([20, 15, 10]);
    expect(pts.map((p) => p.milesHiked)).toEqual([0, 5, 10]);
  });
});

describe("gainLossFt", () => {
  it("sums climbs and descents", () => {
    expect(gainLossFt([1000, 3000, 2000, 4000])).toEqual({ gainFt: 4000, lossFt: 1000 });
  });

  it("ignores jitter below the noise threshold", () => {
    const flat = [1000, 1010, 995, 1008, 1000, 1012, 1000];
    expect(gainLossFt(flat)).toEqual({ gainFt: 0, lossFt: 0 });
  });

  it("always nets to the end-to-end change", () => {
    const e = [500, 512, 530, 519, 600, 590, 610];
    const { gainFt, lossFt } = gainLossFt(e);
    expect(gainFt - lossFt).toBe(610 - 500);
  });

  it("handles empty and single-point input", () => {
    expect(gainLossFt([])).toEqual({ gainFt: 0, lossFt: 0 });
    expect(gainLossFt([1234])).toEqual({ gainFt: 0, lossFt: 0 });
  });
});

describe("hikeLegs", () => {
  it("gives each waypoint after the first its incoming leg (NOBO)", () => {
    const legs = hikeLegs(plan(), WAYPOINTS, SAMPLES);
    expect(legs.has("a")).toBe(false);
    expect(legs.get("b")).toMatchObject({
      fromWaypointId: "a",
      distanceMi: 10,
      gainFt: 2000,
      lossFt: 1000,
    });
    expect(legs.get("c")).toMatchObject({ fromWaypointId: "b", gainFt: 2000, lossFt: 0 });
  });

  it("mirrors legs for SOBO: gain and loss swap", () => {
    const legs = hikeLegs(plan({ direction: "SOBO" }), WAYPOINTS, SAMPLES);
    expect(legs.has("c")).toBe(false);
    expect(legs.get("b")).toMatchObject({ fromWaypointId: "c", gainFt: 0, lossFt: 2000 });
    expect(legs.get("a")).toMatchObject({ fromWaypointId: "b", gainFt: 1000, lossFt: 2000 });
    expect(legs.get("a")!.points.at(-1)!.milesHiked).toBe(20);
  });

  it("covers only the chosen section", () => {
    const legs = hikeLegs(plan({ startWaypointId: "b" }), WAYPOINTS, SAMPLES);
    expect([...legs.keys()]).toEqual(["c"]);
    expect(legs.get("c")!.points[0].milesHiked).toBe(0);
  });
});

describe("sectionProfile", () => {
  it("spans the section in hike order from zero miles hiked", () => {
    const pts = sectionProfile(plan({ direction: "SOBO", endWaypointId: "b" }), WAYPOINTS, SAMPLES);
    expect(pts[0]).toEqual({ trailMile: 20, elevationFt: 4000, milesHiked: 0 });
    expect(pts.at(-1)).toEqual({ trailMile: 10, elevationFt: 2000, milesHiked: 10 });
  });
});
