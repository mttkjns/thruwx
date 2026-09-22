import { beforeEach, describe, expect, it } from "vitest";
import { PLAN_SCHEMA_VERSION } from "../domain/plan";
import { serializePlan, parsePlanJson, planFileName } from "./planIO";
import { usePlanStore } from "./planStore";

// Vanilla zustand access — no React needed to test actions.
const store = () => usePlanStore.getState();

beforeEach(() => {
  store().resetPlan();
});

describe("planStore actions", () => {
  it("sets start date and pace", () => {
    store().setStartDate("2027-04-15");
    store().setPace(18);
    expect(store().plan.startDate).toBe("2027-04-15");
    expect(store().plan.paceMilesPerDay).toBe(18);
  });

  it("sets and clears section endpoints", () => {
    store().setSection("harpers-ferry-wv", undefined);
    expect(store().plan.startWaypointId).toBe("harpers-ferry-wv");
    expect("endWaypointId" in store().plan).toBe(false);
    store().setSection(undefined, undefined);
    expect("startWaypointId" in store().plan).toBe(false);
  });

  it("flipping direction swaps the section endpoints", () => {
    store().setSection("harpers-ferry-wv", undefined);
    store().setDirection("SOBO");
    expect(store().plan.direction).toBe("SOBO");
    expect("startWaypointId" in store().plan).toBe(false);
    expect(store().plan.endWaypointId).toBe("harpers-ferry-wv");
  });

  it("ignores and un-ignores a suggestion; removing the item clears it", () => {
    const itemId = store().addGearItem({ name: "Puffy", category: "insulation" });
    const sug = { itemId, action: "add" as const, waypointId: "damascus-va" };
    store().ignoreSuggestion(sug);
    store().ignoreSuggestion(sug); // idempotent
    expect(store().plan.ignoredSuggestions).toEqual([sug]);

    store().unignoreSuggestion(sug);
    expect(store().plan.ignoredSuggestions).toEqual([]);

    store().ignoreSuggestion(sug);
    store().removeGearItem(itemId);
    expect(store().plan.ignoredSuggestions).toEqual([]);
  });

  it("hides an ignored suggestion and restores it", () => {
    const itemId = store().addGearItem({ name: "Puffy", category: "insulation" });
    const sug = { itemId, action: "remove" as const, waypointId: "hanover-nh" };
    store().ignoreSuggestion(sug);
    store().hideSuggestion(sug);
    expect(store().plan.ignoredSuggestions).toEqual([{ ...sug, hidden: true }]);

    // Ignoring again doesn't un-hide it.
    store().ignoreSuggestion(sug);
    expect(store().plan.ignoredSuggestions).toEqual([{ ...sug, hidden: true }]);

    store().unignoreSuggestion(sug);
    expect(store().plan.ignoredSuggestions).toEqual([]);
  });

  it("adds, updates, and removes gear items", () => {
    const id = store().addGearItem({ name: "Puffy", category: "insulation" });
    expect(store().plan.gear).toHaveLength(1);

    store().updateGearItem(id, { comfortThresholdF: 30 });
    expect(store().plan.gear[0].comfortThresholdF).toBe(30);
    expect(store().plan.gear[0].id).toBe(id); // id is not patchable

    store().removeGearItem(id);
    expect(store().plan.gear).toHaveLength(0);
  });

  it("removing a gear item strips it from swaps", () => {
    const gearId = store().addGearItem({ name: "Puffy", category: "insulation" });
    const swapId = store().addSwap({
      waypointId: "damascus-va",
      addItemIds: [gearId],
      removeItemIds: [],
    });
    store().removeGearItem(gearId);
    const swap = store().plan.swaps.find((s) => s.id === swapId)!;
    expect(swap.addItemIds).toEqual([]);
  });

  it("adds, updates, and removes swaps", () => {
    const id = store().addSwap({ waypointId: "hanover-nh", addItemIds: [], removeItemIds: [] });
    store().updateSwap(id, { waypointId: "damascus-va" });
    expect(store().plan.swaps[0].waypointId).toBe("damascus-va");
    store().removeSwap(id);
    expect(store().plan.swaps).toHaveLength(0);
  });

  it("importPlan loads valid plans and rejects invalid ones untouched", () => {
    const before = store().plan;
    const bad = store().importPlan({ schemaVersion: 99 });
    expect(bad.ok).toBe(false);
    expect(store().plan).toBe(before); // untouched on failure

    const good = store().importPlan({
      schemaVersion: PLAN_SCHEMA_VERSION,
      startDate: "2027-03-15",
      direction: "NOBO",
      paceMilesPerDay: 17,
      gear: [],
      swaps: [],
    });
    expect(good.ok).toBe(true);
    expect(store().plan.startDate).toBe("2027-03-15");
  });
});

describe("plan IO round-trip", () => {
  it("serialize → parse returns an equivalent plan", () => {
    store().setStartDate("2027-03-15");
    store().addGearItem({ name: "Puffy", category: "insulation", comfortThresholdF: 30 });
    const text = serializePlan(store().plan);
    const result = parsePlanJson(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan).toEqual(store().plan);
  });

  it("rejects broken JSON with a friendly error", () => {
    const result = parsePlanJson("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it("builds a safe file name", () => {
    store().setStartDate("2027-03-15");
    store().setPlanName("My AT Thru-Hike!");
    expect(planFileName(store().plan)).toBe("my-at-thru-hike-2027-03-15.json");
    store().setPlanName(undefined);
    expect(planFileName(store().plan)).toBe("thruwx-plan-2027-03-15.json");
  });
});
