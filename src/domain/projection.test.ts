import { describe, expect, it } from "vitest";
import { buildProjection } from "./projection";
import type { ClimateData, DailyNormal, TripPlan, Waypoint } from "./types";

const day = (minF: number): DailyNormal => ({
  normalMaxF: minF + 20,
  normalMinF: minF,
  normalPrecipIn: 0.12,
  freezeProbability: 0.4,
  precipProbability: 0.35,
});

// Station where every day has low 40 — trail 3,000 ft above → corrected low 29.5.
const climate: ClimateData = {
  STN: Array.from({ length: 366 }, () => day(40)),
};

const waypoints: Waypoint[] = [
  {
    id: "springer",
    name: "Springer",
    state: "GA",
    trailMile: 0,
    lat: 34.63,
    lng: -84.19,
    trailElevationFt: 3780,
    isResupply: false,
    stationId: "STN",
    stationElevationFt: 780,
  },
  {
    id: "nostation",
    name: "No Station Gap",
    state: "GA",
    trailMile: 50,
    lat: 34.9,
    lng: -83.8,
    trailElevationFt: 3000,
    isResupply: true,
    stationId: null,
    stationElevationFt: null,
  },
  {
    id: "katahdin",
    name: "Katahdin",
    state: "ME",
    trailMile: 2197.4,
    lat: 45.9,
    lng: -68.92,
    trailElevationFt: 5267,
    isResupply: false,
    stationId: "STN",
    stationElevationFt: 780,
  },
];

const plan: TripPlan = {
  schemaVersion: 1,
  startDate: "2026-03-01",
  direction: "NOBO",
  paceMilesPerDay: 16,
  gear: [],
  swaps: [],
};

describe("buildProjection", () => {
  const projection = buildProjection(plan, waypoints, climate);

  it("projects one entry per waypoint, in order", () => {
    expect(projection.waypoints.map((w) => w.waypointId)).toEqual([
      "springer",
      "nostation",
      "katahdin",
    ]);
  });

  it("derives finishDate and totalDays from the last waypoint", () => {
    expect(projection.totalDays).toBe(137); // floor(2197.4 / 16)
    expect(projection.finishDate).toBe("2026-07-16");
    expect(projection.waypoints[2].arrivalDate).toBe("2026-07-16");
  });

  it("corrects weather per waypoint elevation", () => {
    const springer = projection.waypoints[0].weather!;
    expect(springer.correctedMinF).toBeCloseTo(40 - 0.0035 * 3000, 5);
    const katahdin = projection.waypoints[2].weather!;
    expect(katahdin.elevationDeltaFt).toBe(5267 - 780);
  });

  it("carries null weather for stationless waypoints", () => {
    expect(projection.waypoints[1].weather).toBeNull();
  });

  it("computes sun/moon per waypoint and date", () => {
    for (const w of projection.waypoints) {
      expect(w.sun.sunrise < w.sun.sunset).toBe(true);
      expect(w.sun.dayLengthHours).toBeGreaterThan(8);
      expect(w.sun.dayLengthHours).toBeLessThan(16);
      expect(w.moon.phase).toBeGreaterThanOrEqual(0);
      expect(w.moon.phase).toBeLessThan(1);
    }
    // Mid-July at Katahdin is distinctly longer than early March at Springer.
    expect(projection.waypoints[2].sun.dayLengthHours).toBeGreaterThan(
      projection.waypoints[0].sun.dayLengthHours,
    );
  });

  it("produces swap suggestions through the composed pipeline", () => {
    const gearPlan: TripPlan = {
      ...plan,
      gear: [{ id: "puffy", name: "Puffy", category: "insulation", comfortThresholdF: 25 }],
    };
    // Corrected lows: springer 29.5 (warm), katahdin 24.3 (cold) → one add,
    // placed at the only resupply between them.
    const p = buildProjection(gearPlan, waypoints, climate);
    expect(p.suggestedSwaps).toHaveLength(1);
    expect(p.suggestedSwaps[0]).toMatchObject({
      action: "add",
      itemId: "puffy",
      waypointId: "nostation",
      triggerWaypointId: "katahdin",
    });
  });

  it("rejects an empty waypoint list", () => {
    expect(() => buildProjection(plan, [], climate)).toThrow();
  });
});
