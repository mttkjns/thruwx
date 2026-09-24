import { describe, expect, it } from "vitest";
import { cToF, fromUnit, fToC, lapsePer1000Ft, toUnit } from "./units";

describe("temperature conversion", () => {
  it("anchors at freezing, boiling, and -40", () => {
    expect(fToC(32)).toBe(0);
    expect(fToC(212)).toBe(100);
    expect(fToC(-40)).toBe(-40);
    expect(cToF(0)).toBe(32);
    expect(cToF(-40)).toBe(-40);
  });

  it("round-trips without drift", () => {
    for (const f of [-12, 0, 28.6, 40, 71.3]) {
      expect(cToF(fToC(f))).toBeCloseTo(f, 10);
    }
  });

  it("toUnit/fromUnit are identity for °F and invert each other for °C", () => {
    expect(toUnit(50, "F")).toBe(50);
    expect(fromUnit(50, "F")).toBe(50);
    expect(toUnit(50, "C")).toBeCloseTo(10, 10);
    expect(fromUnit(5, "C")).toBeCloseTo(41, 10);
  });
});

describe("lapsePer1000Ft", () => {
  it("is 3.5°F, or 1.9°C (a difference: no 32° offset)", () => {
    expect(lapsePer1000Ft("F")).toBeCloseTo(3.5, 10);
    expect(lapsePer1000Ft("C").toFixed(1)).toBe("1.9");
  });
});
