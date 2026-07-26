import { describe, expect, it } from "vitest";
import { moonPhaseName, sunAndMoon } from "./sun";

// Hanover, NH — mid-trail-north latitude.
const LAT = 43.7;
const LNG = -72.29;

describe("sunAndMoon", () => {
  it("summer solstice at Hanover is a long day (~15.4 h)", () => {
    const { sun } = sunAndMoon("2026-06-21", LAT, LNG);
    expect(sun.dayLengthHours).toBeGreaterThan(15);
    expect(sun.dayLengthHours).toBeLessThan(16);
  });

  it("winter solstice at Hanover is a short day (~9 h)", () => {
    const { sun } = sunAndMoon("2026-12-21", LAT, LNG);
    expect(sun.dayLengthHours).toBeGreaterThan(8.5);
    expect(sun.dayLengthHours).toBeLessThan(9.5);
  });

  it("sunrise precedes sunset and both fall on the requested local day", () => {
    const { sun } = sunAndMoon("2026-03-15", LAT, LNG);
    expect(sun.sunrise < sun.sunset).toBe(true);
    // 2026-03-15 EDT is UTC-4: local day = 04:00Z Mar 15 .. 04:00Z Mar 16.
    expect(sun.sunrise >= "2026-03-15T04:00").toBe(true);
    expect(sun.sunset <= "2026-03-16T04:00").toBe(true);
  });

  it("moon values are within range and phase name matches the bucket", () => {
    const { moon } = sunAndMoon("2026-03-15", LAT, LNG);
    expect(moon.phase).toBeGreaterThanOrEqual(0);
    expect(moon.phase).toBeLessThan(1);
    expect(moon.illumination).toBeGreaterThanOrEqual(0);
    expect(moon.illumination).toBeLessThanOrEqual(1);
    expect(moon.phaseName).toBe(moonPhaseName(moon.phase));
  });

  it("further north = longer summer days (Katahdin vs Springer)", () => {
    const springer = sunAndMoon("2026-06-21", 34.63, -84.19).sun.dayLengthHours;
    const katahdin = sunAndMoon("2026-06-21", 45.9, -68.92).sun.dayLengthHours;
    expect(katahdin).toBeGreaterThan(springer);
  });
});

describe("moonPhaseName", () => {
  it("maps the compass points of the cycle", () => {
    expect(moonPhaseName(0)).toBe("new");
    expect(moonPhaseName(0.25)).toBe("first-quarter");
    expect(moonPhaseName(0.5)).toBe("full");
    expect(moonPhaseName(0.75)).toBe("last-quarter");
    expect(moonPhaseName(0.99)).toBe("new"); // wraps
  });
});
