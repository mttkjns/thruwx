import { describe, expect, it } from "vitest";
import { projectSchedule } from "./schedule";
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

const plan = (startDate: string, paceMilesPerDay: number): TripPlan => ({
  schemaVersion: 1,
  startDate,
  direction: "NOBO",
  paceMilesPerDay,
  gear: [],
  swaps: [],
});

describe("projectSchedule", () => {
  it("puts mile 0 on the start date, day 0", () => {
    const [springer] = projectSchedule(plan("2026-03-01", 15), [wp("springer", 0)]);
    expect(springer).toEqual({
      waypointId: "springer",
      arrivalDate: "2026-03-01",
      dayOfHike: 0,
    });
  });

  it("floors partial days (mile 31.7 at 15 mi/day → day 2)", () => {
    const [neels] = projectSchedule(plan("2026-03-01", 15), [wp("neels", 31.7)]);
    expect(neels.dayOfHike).toBe(2);
    expect(neels.arrivalDate).toBe("2026-03-03");
  });

  it("projects a full-trail scale correctly (2197 mi at 16 mi/day ≈ 137 days)", () => {
    const [katahdin] = projectSchedule(plan("2026-03-01", 16), [wp("katahdin", 2197.4)]);
    expect(katahdin.dayOfHike).toBe(137);
    expect(katahdin.arrivalDate).toBe("2026-07-16");
  });

  it("keeps waypoint order and monotone arrival dates", () => {
    const entries = projectSchedule(plan("2026-03-01", 15), [
      wp("a", 0),
      wp("b", 100),
      wp("c", 500),
    ]);
    expect(entries.map((e) => e.waypointId)).toEqual(["a", "b", "c"]);
    expect(entries[0].arrivalDate <= entries[1].arrivalDate).toBe(true);
    expect(entries[1].arrivalDate <= entries[2].arrivalDate).toBe(true);
  });

  it("rejects non-positive pace", () => {
    expect(() => projectSchedule(plan("2026-03-01", 0), [wp("a", 0)])).toThrow();
    expect(() => projectSchedule(plan("2026-03-01", -5), [wp("a", 0)])).toThrow();
  });
});
