/**
 * The persisted plan store. Holds exactly ONE thing durably: the user's
 * TripPlan (intent). Projections are derived elsewhere (useProjection) and
 * never live here. Persists to localStorage via zustand/persist; only `plan`
 * is written (partialize), so actions and any future transient state stay out.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDefaultPlan, PLAN_SCHEMA_VERSION, validateTripPlan } from "../domain/plan";
import { sameSuggestion } from "../domain/swaps";
import type { GearItem, GearSwap, HikeDirection, IgnoredSuggestion, TripPlan } from "../domain/types";
import { newId } from "./ids";

interface PlanState {
  plan: TripPlan;
  setStartDate: (startDate: string) => void;
  setPace: (paceMilesPerDay: number) => void;
  /** Flipping direction also swaps the section endpoints, so the same stretch is hiked the other way. */
  setDirection: (direction: HikeDirection) => void;
  /** Section endpoints; undefined = the trail terminus for the current direction. */
  setSection: (startWaypointId: string | undefined, endWaypointId: string | undefined) => void;
  setPlanName: (name: string | undefined) => void;
  addGearItem: (item: Omit<GearItem, "id">) => string;
  updateGearItem: (id: string, patch: Partial<Omit<GearItem, "id">>) => void;
  /** Also strips the item from every swap's add/remove lists and from ignored suggestions. */
  removeGearItem: (id: string) => void;
  addSwap: (swap: Omit<GearSwap, "id">) => string;
  updateSwap: (id: string, patch: Partial<Omit<GearSwap, "id">>) => void;
  removeSwap: (id: string) => void;
  ignoreSuggestion: (suggestion: IgnoredSuggestion) => void;
  /** Also un-hides: the suggestion goes back to a normal, actionable row. */
  unignoreSuggestion: (suggestion: IgnoredSuggestion) => void;
  /** Remove an ignored suggestion from the list (ignores it first if needed). */
  hideSuggestion: (suggestion: IgnoredSuggestion) => void;
  /** Validated import; returns errors instead of loading anything invalid. */
  importPlan: (input: unknown) => { ok: true } | { ok: false; errors: string[] };
  resetPlan: () => void;
}

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: createDefaultPlan(),

      setStartDate: (startDate) =>
        set((s) => ({ plan: { ...s.plan, startDate } })),

      setPace: (paceMilesPerDay) =>
        set((s) => ({ plan: { ...s.plan, paceMilesPerDay } })),

      setDirection: (direction) =>
        set((s) => {
          if (direction === s.plan.direction) return s;
          const { startWaypointId, endWaypointId, ...rest } = s.plan;
          return {
            plan: {
              ...rest,
              direction,
              ...(endWaypointId !== undefined ? { startWaypointId: endWaypointId } : {}),
              ...(startWaypointId !== undefined ? { endWaypointId: startWaypointId } : {}),
            },
          };
        }),

      setSection: (startWaypointId, endWaypointId) =>
        set((s) => {
          const { startWaypointId: _s, endWaypointId: _e, ...rest } = s.plan;
          return {
            plan: {
              ...rest,
              ...(startWaypointId !== undefined ? { startWaypointId } : {}),
              ...(endWaypointId !== undefined ? { endWaypointId } : {}),
            },
          };
        }),

      setPlanName: (name) => set((s) => ({ plan: { ...s.plan, name } })),

      addGearItem: (item) => {
        const id = newId();
        set((s) => ({ plan: { ...s.plan, gear: [...s.plan.gear, { ...item, id }] } }));
        return id;
      },

      updateGearItem: (id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            gear: s.plan.gear.map((g) => (g.id === id ? { ...g, ...patch, id } : g)),
          },
        })),

      removeGearItem: (id) =>
        set((s) => ({
          plan: {
            ...s.plan,
            gear: s.plan.gear.filter((g) => g.id !== id),
            swaps: s.plan.swaps.map((sw) => ({
              ...sw,
              addItemIds: sw.addItemIds.filter((x) => x !== id),
              removeItemIds: sw.removeItemIds.filter((x) => x !== id),
            })),
            ...(s.plan.ignoredSuggestions
              ? { ignoredSuggestions: s.plan.ignoredSuggestions.filter((ig) => ig.itemId !== id) }
              : {}),
          },
        })),

      addSwap: (swap) => {
        const id = newId();
        set((s) => ({ plan: { ...s.plan, swaps: [...s.plan.swaps, { ...swap, id }] } }));
        return id;
      },

      updateSwap: (id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            swaps: s.plan.swaps.map((sw) => (sw.id === id ? { ...sw, ...patch, id } : sw)),
          },
        })),

      removeSwap: (id) =>
        set((s) => ({
          plan: { ...s.plan, swaps: s.plan.swaps.filter((sw) => sw.id !== id) },
        })),

      ignoreSuggestion: ({ itemId, action, waypointId }) =>
        set((s) => {
          const current = s.plan.ignoredSuggestions ?? [];
          const entry = { itemId, action, waypointId };
          if (current.some((ig) => sameSuggestion(ig, entry))) return s;
          return { plan: { ...s.plan, ignoredSuggestions: [...current, entry] } };
        }),

      unignoreSuggestion: (suggestion) =>
        set((s) => ({
          plan: {
            ...s.plan,
            ignoredSuggestions: (s.plan.ignoredSuggestions ?? []).filter(
              (ig) => !sameSuggestion(ig, suggestion),
            ),
          },
        })),

      hideSuggestion: ({ itemId, action, waypointId }) =>
        set((s) => {
          const entry = { itemId, action, waypointId, hidden: true };
          const rest = (s.plan.ignoredSuggestions ?? []).filter((ig) => !sameSuggestion(ig, entry));
          return { plan: { ...s.plan, ignoredSuggestions: [...rest, entry] } };
        }),

      importPlan: (input) => {
        const result = validateTripPlan(input);
        if (!result.ok) return { ok: false, errors: result.errors };
        set({ plan: result.plan });
        return { ok: true };
      },

      resetPlan: () => set({ plan: createDefaultPlan() }),
    }),
    {
      name: "thruwx-plan",
      version: PLAN_SCHEMA_VERSION,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({ plan: state.plan }),
      // v1 is the first persisted shape; add real migrations when bumping.
      migrate: (persisted) => persisted as { plan: TripPlan },
    },
  ),
);
