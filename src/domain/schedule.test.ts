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

const plan = (
  startDate: string,
  paceMilesPerDay: number,
  direction: TripPlan["direction"] = "NOBO",
): TripPlan => ({
  schemaVersion: 1,
  startDate,
  direction,
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

  describe("SOBO", () => {
    const trail = [wp("springer", 0), wp("mid", 1100), wp("katahdin", 2197.4)];

    it("starts at the highest trail mile on day 0 and returns hike order", () => {
      const entries = projectSchedule(plan("2026-06-15", 16, "SOBO"), trail);
      expect(entries.map((e) => e.waypointId)).toEqual(["katahdin", "mid", "springer"]);
      expect(entries[0]).toEqual({
        waypointId: "katahdin",
        arrivalDate: "2026-06-15",
        dayOfHike: 0,
      });
    });

    it("computes miles hiked as maxMile - trailMile", () => {
      const entries = projectSchedule(plan("2026-06-15", 16, "SOBO"), trail);
      // mid: (2197.4 - 1100) / 16 = 68.5 → day 68
      expect(entries[1].dayOfHike).toBe(68);
      // springer: 2197.4 / 16 = 137.3 → day 137, same total length as NOBO
      expect(entries[2].dayOfHike).toBe(137);
    });

    it("mirrors NOBO total duration", () => {
      const nobo = projectSchedule(plan("2026-03-01", 16), trail);
      const sobo = projectSchedule(plan("2026-06-15", 16, "SOBO"), trail);
      expect(sobo[sobo.length - 1].dayOfHike).toBe(nobo[nobo.length - 1].dayOfHike);
    });
  });
});

describe("projectSchedule — section hikes", () => {
  const trail = [wp("springer", 0), wp("hot-springs", 274.9), wp("harpers", 1025), wp("katahdin", 2197.4)];

  it("NOBO: day 0 at the start waypoint, miles counted from it", () => {
    const entries = projectSchedule(
      { ...plan("2027-05-01", 15), startWaypointId: "hot-springs", endWaypointId: "harpers" },
      trail,
    );
    expect(entries.map((e) => e.waypointId)).toEqual(["hot-springs", "harpers"]);
    expect(entries[0]).toEqual({ waypointId: "hot-springs", arrivalDate: "2027-05-01", dayOfHike: 0 });
    // (1025 − 274.9) / 15 = 50.0 → day 50
    expect(entries[1].dayOfHike).toBe(50);
  });

  it("SOBO: counts miles back down from the start waypoint", () => {
    const entries = projectSchedule(
      { ...plan("2027-07-01", 16, "SOBO"), startWaypointId: "harpers" },
      trail,
    );
    expect(entries.map((e) => e.waypointId)).toEqual(["harpers", "hot-springs", "springer"]);
    // (1025 − 274.9) / 16 = 46.9 → day 46; 1025 / 16 = 64.06 → day 64
    expect(entries.map((e) => e.dayOfHike)).toEqual([0, 46, 64]);
  });
});
