/**
 * Display units — a viewer preference, NOT plan intent. Kept out of TripPlan
 * so plan export/import stays unit-independent; persisted on its own key.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TempUnit } from "../domain/units";
import { noopStorage } from "./planStore";

interface UnitsState {
  temp: TempUnit;
  setTemp: (temp: TempUnit) => void;
}

export const useUnitsStore = create<UnitsState>()(
  persist(
    (set) => ({
      temp: "F",
      setTemp: (temp) => set({ temp }),
    }),
    {
      name: "thruwx-units",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({ temp: state.temp }),
    },
  ),
);
