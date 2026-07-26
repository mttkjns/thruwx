import { describe, expect, it } from "vitest";
import type { ClimateData, Waypoint } from "../domain/types";
import waypointsJson from "./waypoints.json";
import climateJson from "./climate.json";

const climate = climateJson as ClimateData;
const waypoints: Waypoint[] = waypointsJson;

const JAN15 = 14;
const APR15 = 105;
const JUL15 = 196;

function stationOf(waypointId: string) {
  const wp = waypoints.find((w) => w.id === waypointId);
  if (!wp?.stationId) throw new Error(`${waypointId}: no station assigned`);
  return climate[wp.stationId];
}

describe("climate.json", () => {
  it("covers every assigned station in waypoints.json", () => {
    for (const wp of waypoints) {
      expect(wp.stationId, wp.id).not.toBeNull();
      expect(climate[wp.stationId!], `${wp.id} → ${wp.stationId}`).toBeDefined();
    }
  });

  it("has 366 well-formed days per station", () => {
    for (const [sid, days] of Object.entries(climate)) {
      expect(days, sid).toHaveLength(366);
      for (const [i, d] of days.entries()) {
        const label = `${sid}[${i}]`;
        expect(Number.isFinite(d.normalMaxF), label).toBe(true);
        expect(Number.isFinite(d.normalMinF), label).toBe(true);
        expect(d.normalMaxF, label).toBeGreaterThan(d.normalMinF);
        expect(d.normalPrecipIn, label).toBeGreaterThanOrEqual(0);
        expect(d.freezeProbability, label).toBeGreaterThanOrEqual(0);
        expect(d.freezeProbability, label).toBeLessThanOrEqual(1);
        expect(d.precipProbability, label).toBeGreaterThanOrEqual(0);
        expect(d.precipProbability, label).toBeLessThanOrEqual(1);
      }
    }
  });

  it("temperatures stay in a plausible eastern-US range", () => {
    for (const [sid, days] of Object.entries(climate)) {
      for (const d of days) {
        expect(d.normalMaxF, sid).toBeLessThan(110);
        expect(d.normalMinF, sid).toBeGreaterThan(-40);
      }
    }
  });

  // The Phase 2 sanity checks from the build plan. Raw station values —
  // elevation correction (Phase 3) only makes the highlands colder.
  it("southern highlands still freeze in mid-April", () => {
    const clingmans = stationOf("clingmans-dome");
    expect(clingmans[APR15].freezeProbability).toBeGreaterThan(0.25);
  });

  it("mid-Atlantic is hot in July, northern New England is cold in January", () => {
    expect(stationOf("duncannon-pa")[JUL15].normalMaxF).toBeGreaterThan(80);
    expect(stationOf("rangeley-me")[JAN15].normalMinF).toBeLessThan(10);
    expect(stationOf("rangeley-me")[JAN15].freezeProbability).toBeGreaterThan(0.95);
  });

  it("Feb 29 (index 59) is pooled, not a ~8-sample outlier", () => {
    for (const [sid, days] of Object.entries(climate)) {
      const feb28 = days[58];
      const mar1 = days[60];
      const feb29 = days[59];
      const lo = Math.min(feb28.normalMaxF, mar1.normalMaxF) - 3;
      const hi = Math.max(feb28.normalMaxF, mar1.normalMaxF) + 3;
      expect(feb29.normalMaxF, sid).toBeGreaterThanOrEqual(lo);
      expect(feb29.normalMaxF, sid).toBeLessThanOrEqual(hi);
    }
  });
});
