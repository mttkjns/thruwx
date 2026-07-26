import { describe, expect, it } from "vitest";
import type { ClimateData, DailyNormal, Waypoint } from "./types";
import { weatherAtWaypoint } from "./weather";

const flatDay: DailyNormal = {
  normalMaxF: 50,
  normalMinF: 30,
  normalPrecipIn: 0.1,
  freezeProbability: 0.6,
  precipProbability: 0.4,
};

/** 366 identical days except Jul 15 (index 196), which is marked. */
const julDay: DailyNormal = { ...flatDay, normalMaxF: 80, normalMinF: 60 };
const days = Array.from({ length: 366 }, (_, i) => (i === 196 ? julDay : flatDay));
const climate: ClimateData = { STN1: days };

const waypoint: Waypoint = {
  id: "gap",
  name: "Some Gap",
  state: "NC",
  trailMile: 100,
  lat: 35,
  lng: -83,
  trailElevationFt: 5000,
  isResupply: true,
  stationId: "STN1",
  stationElevationFt: 2000, // trail 3,000 ft above station → 10.5°F colder
};

describe("weatherAtWaypoint", () => {
  it("applies the lapse correction to both high and low", () => {
    const w = weatherAtWaypoint(waypoint, "2026-01-15", climate)!;
    expect(w.stationMaxF).toBe(50);
    expect(w.stationMinF).toBe(30);
    expect(w.correctedMaxF).toBeCloseTo(39.5, 5);
    expect(w.correctedMinF).toBeCloseTo(19.5, 5);
    expect(w.elevationDeltaFt).toBe(3000);
  });

  it("looks up the arrival date's day-of-year (leap layout)", () => {
    const w = weatherAtWaypoint(waypoint, "2026-07-15", climate)!;
    expect(w.stationMaxF).toBe(80); // the marked Jul 15 entry
    expect(w.correctedMaxF).toBeCloseTo(69.5, 5);
  });

  it("passes precip and probabilities through uncorrected", () => {
    const w = weatherAtWaypoint(waypoint, "2026-01-15", climate)!;
    expect(w.precipIn).toBe(0.1);
    expect(w.freezeProbability).toBe(0.6);
    expect(w.precipProbability).toBe(0.4);
  });

  it("returns null (not raw temps) when no station is assigned", () => {
    const bare = { ...waypoint, stationId: null, stationElevationFt: null };
    expect(weatherAtWaypoint(bare, "2026-01-15", climate)).toBeNull();
  });

  it("returns null when the station is missing from climate data", () => {
    const orphan = { ...waypoint, stationId: "NOPE" };
    expect(weatherAtWaypoint(orphan, "2026-01-15", climate)).toBeNull();
  });
});
