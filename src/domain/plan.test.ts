import { describe, expect, it } from "vitest";
import {
  createDefaultPlan,
  defaultStartDate,
  isValidIsoDate,
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

  it("rejects non-objects", () => {
    expect(validateTripPlan(null).ok).toBe(false);
    expect(validateTripPlan([]).ok).toBe(false);
    expect(validateTripPlan("plan").ok).toBe(false);
  });

  it("collects multiple errors in one pass", () => {
    const result = validateTripPlan({
      schemaVersion: 99,
      startDate: "not-a-date",
      direction: "SOBO",
      paceMilesPerDay: -3,
      gear: [],
      swaps: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(4);
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
