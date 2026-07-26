import { describe, expect, it } from "vitest";
import { correctForElevation, LAPSE_RATE_PER_FT } from "./elevation";

describe("correctForElevation", () => {
  it("cools 10.5°F for 3,000 ft of gain (the BUILD_PLAN reference case)", () => {
    expect(correctForElevation(50, 1000, 4000)).toBeCloseTo(39.5, 5);
  });

  it("warms when the trail sits below the station", () => {
    expect(correctForElevation(50, 4000, 1000)).toBeCloseTo(60.5, 5);
  });

  it("is identity at zero delta", () => {
    expect(correctForElevation(50, 2500, 2500)).toBe(50);
  });

  it("uses 3.5°F per 1,000 ft by default", () => {
    expect(LAPSE_RATE_PER_FT).toBe(0.0035);
  });

  it("accepts a custom lapse rate", () => {
    expect(correctForElevation(50, 0, 1000, 0.005)).toBeCloseTo(45, 5);
  });
});
