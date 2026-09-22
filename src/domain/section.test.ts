import { describe, expect, it } from "vitest";
import { hikeOrder, hikeSection } from "./section";
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

const trail = [wp("springer", 0), wp("hot-springs", 274.9), wp("harpers", 1025), wp("katahdin", 2197.4)];

const plan = (over: Partial<TripPlan> = {}): TripPlan => ({
  schemaVersion: 1,
  startDate: "2027-03-01",
  direction: "NOBO",
  paceMilesPerDay: 15,
  gear: [],
  swaps: [],
  ...over,
});

const ids = (ws: Waypoint[]) => ws.map((w) => w.id);

describe("hikeOrder", () => {
  it("sorts ascending for NOBO and descending for SOBO", () => {
    const shuffled = [trail[2], trail[0], trail[3], trail[1]];
    expect(ids(hikeOrder("NOBO", shuffled))).toEqual(["springer", "hot-springs", "harpers", "katahdin"]);
    expect(ids(hikeOrder("SOBO", shuffled))).toEqual(["katahdin", "harpers", "hot-springs", "springer"]);
  });
});

describe("hikeSection", () => {
  it("is the whole trail when no endpoints are set", () => {
    expect(ids(hikeSection(plan(), trail))).toEqual(["springer", "hot-springs", "harpers", "katahdin"]);
    expect(ids(hikeSection(plan({ direction: "SOBO" }), trail))).toEqual([
      "katahdin",
      "harpers",
      "hot-springs",
      "springer",
    ]);
  });

  it("slices NOBO between start and end inclusive", () => {
    const s = hikeSection(plan({ startWaypointId: "hot-springs", endWaypointId: "harpers" }), trail);
    expect(ids(s)).toEqual(["hot-springs", "harpers"]);
  });

  it("slices SOBO in descending order", () => {
    const s = hikeSection(
      plan({ direction: "SOBO", startWaypointId: "harpers", endWaypointId: "springer" }),
      trail,
    );
    expect(ids(s)).toEqual(["harpers", "hot-springs", "springer"]);
  });

  it("falls back to the terminus for unknown ids", () => {
    const s = hikeSection(plan({ startWaypointId: "nope", endWaypointId: "gone" }), trail);
    expect(ids(s)).toEqual(["springer", "hot-springs", "harpers", "katahdin"]);
  });

  it("runs to the terminus when the end is at or behind the start", () => {
    expect(ids(hikeSection(plan({ startWaypointId: "harpers", endWaypointId: "hot-springs" }), trail))).toEqual([
      "harpers",
      "katahdin",
    ]);
    expect(ids(hikeSection(plan({ startWaypointId: "harpers", endWaypointId: "harpers" }), trail))).toEqual([
      "harpers",
      "katahdin",
    ]);
  });
});
