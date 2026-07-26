/**
 * Climate data, loaded on demand. climate.json is ~1.4 MB raw (~140 KB over
 * the wire) — keeping it out of the main bundle lets the UI paint instantly;
 * the user explicitly loads the data (size shown) before temperatures appear.
 *
 * Consent is remembered: after the first successful load, subsequent visits
 * fetch automatically (the browser cache usually makes that free).
 */
import { create } from "zustand";
import type { ClimateData } from "../domain/types";
// Vite emits the JSON as a hashed static asset and hands us its URL —
// nothing lands in the JS bundle.
import climateUrl from "../data/climate.json?url";

export const CLIMATE_SIZE_NOTE = "1.4 MB (≈140 KB compressed)";

const AUTOLOAD_KEY = "thruwx-climate-autoload";

export type ClimateStatus = "idle" | "loading" | "ready" | "error";

interface ClimateState {
  climate: ClimateData | null;
  status: ClimateStatus;
  error?: string;
  load: () => Promise<void>;
}

export const useClimateStore = create<ClimateState>()((set, get) => ({
  climate: null,
  status: "idle",

  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: undefined });
    try {
      const res = await fetch(climateUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const climate = (await res.json()) as ClimateData;
      set({ climate, status: "ready" });
      try {
        localStorage.setItem(AUTOLOAD_KEY, "1");
      } catch {
        // storage unavailable (private mode) — consent just won't persist
      }
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

/** Auto-load on later visits, once the user consented before. */
export function autoLoadClimateIfConsented(): void {
  try {
    if (localStorage.getItem(AUTOLOAD_KEY) === "1") {
      void useClimateStore.getState().load();
    }
  } catch {
    // storage unavailable — stay idle until the user clicks
  }
}
