import { describe, expect, it } from "vitest";
import {
  createDefaultPlan,
  defaultStartDate,
  isValidIsoDate,
  planWarnings,
  validateTripPlan,
} from "./plan";
import type { TripPlan } from "./types";

const valid: TripPlan = {
  schemaVersion: 1,
  startDate: "2027-03-01",
  direction: "NOBO",
  paceMilesPerDay: 15,
  gear: [
    { id: "puffy", name: "Down jacket", category: "insulation", comfortThresholdF: 30 },
  ],
  swaps: [
    { id: "s1", waypointId: "damascus-va", addItemIds: [], removeItemIds: ["puffy"] },
  ],
};

describe("defaultStartDate", () => {
  it("picks this year's March 1 when still ahead", () => {
    expect(defaultStartDate(new Date("2027-01-15T00:00:00Z"))).toBe("2027-03-01");
  });
  it("rolls to next year once March 1 has passed", () => {
    expect(defaultStartDate(new Date("2026-07-26T00:00:00Z"))).toBe("2027-03-01");
  });
});

describe("createDefaultPlan", () => {
  it("is itself a valid plan", () => {
    const result = validateTripPlan(createDefaultPlan());
    expect(result.ok).toBe(true);
  });
});

describe("planWarnings", () => {
  const today = new Date("2026-07-26T12:00:00Z");
  const planAt = (startDate: string, pace: number): TripPlan => ({
    ...valid,
    startDate,
    paceMilesPerDay: pace,
  });

  it("is quiet for a plausible plan", () => {
    expect(planWarnings(planAt("2027-03-01", 16), "2027-07-16", today)).toEqual([]);
  });

  it("flags a start date in the past", () => {
    const w = planWarnings(planAt("2026-01-01", 16), "2026-05-18", today);
    expect(w.some((x) => x.includes("past"))).toBe(true);
  });

  it("flags finishing after Baxter's mid-October close", () => {
    const w = planWarnings(planAt("2027-05-01", 10), "2027-12-08", today);
    expect(w.some((x) => x.includes("Baxter"))).toBe(true);
  });

  it("flags a finish that rolls into the next calendar year", () => {
    const w = planWarnings(planAt("2027-09-01", 8), "2028-06-01", today);
    expect(w.some((x) => x.includes("Baxter"))).toBe(true);
  });

  it("flags elite pace", () => {
    const w = planWarnings(planAt("2027-03-01", 35), "2027-05-03", today);
    expect(w.some((x) => x.includes("elite"))).toBe(true);
  });

  it("SOBO: flags starting before Baxter opens, not the finish", () => {
    const sobo: TripPlan = { ...valid, direction: "SOBO", startDate: "2027-04-01" };
    const w = planWarnings(sobo, "2027-08-19", today);
    expect(w.some((x) => x.includes("southbounders"))).toBe(true);
    expect(w.some((x) => x.includes("closes"))).toBe(false);
  });

  it("SOBO: quiet for a mid-June start", () => {
    const sobo: TripPlan = { ...valid, direction: "SOBO", startDate: "2027-06-15" };
    expect(planWarnings(sobo, "2027-11-01", today)).toEqual([]);
  });

  describe("section hikes", () => {
    const at = (id: string, trailMile: number) =>
      ({ id, name: id, state: "GA", trailMile, lat: 0, lng: 0, trailElevationFt: 0,
         isResupply: true, stationId: null, stationElevationFt: null });
    const trail = [at("springer", 0), at("harpers", 1025), at("katahdin", 2197.4)];

    it("NOBO: no Baxter warning when the section ends short of Katahdin", () => {
      const p: TripPlan = { ...planAt("2027-05-01", 10), endWaypointId: "harpers" };
      expect(planWarnings(p, "2027-12-08", today, trail)).toEqual([]);
    });

    it("NOBO: still warns when the section ends at Katahdin", () => {
      const p: TripPlan = { ...planAt("2027-05-01", 10), startWaypointId: "harpers" };
      const w = planWarnings(p, "2027-12-08", today, trail);
      expect(w.some((x) => x.includes("Baxter"))).toBe(true);
    });

    it("SOBO: no early-start warning when the section starts south of Katahdin", () => {
      const p: TripPlan = { ...valid, direction: "SOBO", startDate: "2027-04-01", startWaypointId: "harpers" };
      expect(planWarnings(p, "2027-06-10", today, trail)).toEqual([]);
    });
  });
});

describe("isValidIsoDate", () => {
  it("accepts real dates and rejects malformed or impossible ones", () => {
    expect(isValidIsoDate("2027-03-01")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true); // real leap day
    expect(isValidIsoDate("2023-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("2027-13-01")).toBe(false);
    expect(isValidIsoDate("03/01/2027")).toBe(false);
    expect(isValidIsoDate(20270301)).toBe(false);
  });
});

describe("validateTripPlan", () => {
  it("accepts a valid plan and echoes its content", () => {
    const result = validateTripPlan(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.gear[0].comfortThresholdF).toBe(30);
      expect(result.plan.swaps[0].removeItemIds).toEqual(["puffy"]);
    }
  });

  it("keeps section endpoints and rejects malformed ones", () => {
    const withSection = validateTripPlan({ ...valid, startWaypointId: "harpers", endWaypointId: "katahdin" });
    expect(withSection.ok && withSection.plan.startWaypointId).toBe("harpers");
    expect(withSection.ok && withSection.plan.endWaypointId).toBe("katahdin");
    expect(validateTripPlan({ ...valid, startWaypointId: 7 }).ok).toBe(false);
    expect(validateTripPlan({ ...valid, endWaypointId: "" }).ok).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validateTripPlan(null).ok).toBe(false);
    expect(validateTripPlan([]).ok).toBe(false);
    expect(validateTripPlan("plan").ok).toBe(false);
  });

  it("collects multiple errors in one pass", () => {
    const result = validateTripPlan({
      schemaVersion: 99,
      startDate: "not-a-date",
      direction: "YOYO",
      paceMilesPerDay: -3,
      gear: [],
      swaps: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("accepts SOBO plans and preserves the direction", () => {
    const result = validateTripPlan({ ...valid, direction: "SOBO" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.direction).toBe("SOBO");
  });

  it("rejects swaps that reference unknown gear", () => {
    const result = validateTripPlan({
      ...valid,
      swaps: [{ id: "s1", waypointId: "x", addItemIds: ["ghost"], removeItemIds: [] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/unknown gear id "ghost"/);
  });

  it("rejects duplicate gear ids", () => {
    const dup = { ...valid.gear[0] };
    const result = validateTripPlan({ ...valid, gear: [valid.gear[0], dup], swaps: [] });
    expect(result.ok).toBe(false);
  });

  it("coerces unknown gear categories to 'other' instead of erroring", () => {
    const result = validateTripPlan({
      ...valid,
      gear: [{ id: "x", name: "Mystery", category: "gadgets" }],
      swaps: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.gear[0].category).toBe("other");
  });

  it("rejects implausible pace", () => {
    expect(validateTripPlan({ ...valid, paceMilesPerDay: 0 }).ok).toBe(false);
    expect(validateTripPlan({ ...valid, paceMilesPerDay: 200 }).ok).toBe(false);
    expect(validateTripPlan({ ...valid, paceMilesPerDay: "15" }).ok).toBe(false);
  });
});
