import { getMoonIllumination } from "suncalc";
import { describe, expect, it } from "vitest";
import { parseIsoDate } from "./dates";
import { fullMoonDates } from "./moon";

describe("fullMoonDates", () => {
  // A typical NOBO window: Mar 1 2027 + 146 days.
  const dates = fullMoonDates("2027-03-01", 146);

  it("finds roughly one per synodic month (146 days ≈ 4.9 cycles)", () => {
    expect(dates.length).toBeGreaterThanOrEqual(4);
    expect(dates.length).toBeLessThanOrEqual(5);
  });

  it("spaces them ~29.5 days apart", () => {
    for (let i = 1; i < dates.length; i++) {
      const gap =
        (parseIsoDate(dates[i]).getTime() - parseIsoDate(dates[i - 1]).getTime()) /
        86_400_000;
      expect(gap).toBeGreaterThanOrEqual(29);
      expect(gap).toBeLessThanOrEqual(31);
    }
  });

  it("each returned date is essentially fully illuminated", () => {
    for (const d of dates) {
      const noon = new Date(parseIsoDate(d).getTime() + 12 * 3600 * 1000);
      expect(getMoonIllumination(noon).fraction).toBeGreaterThan(0.97);
    }
  });

  it("returns nothing for a window with no full moon", () => {
    // The 3 days right after a found full moon can't contain another.
    expect(fullMoonDates(dates[0], 3).length).toBeLessThanOrEqual(1);
    expect(fullMoonDates("2027-03-01", 0)).toEqual([]);
  });
});
