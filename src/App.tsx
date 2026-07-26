import { lazy, Suspense, useEffect, useState } from "react";
import { autoLoadClimateIfConsented } from "./state/climateStore";
import { GearView } from "./views/GearView";
import { TimelineView } from "./views/TimelineView";

// Leaflet (~43 KB gzip) loads only when the map tab is opened.
const MapView = lazy(() => import("./views/MapView"));

type Tab = "timeline" | "map" | "gear";

export default function App() {
  const [tab, setTab] = useState<Tab>("timeline");
  useEffect(autoLoadClimateIfConsented, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold tracking-tight">
            ThruWx
            <span className="ml-2 hidden text-sm font-normal text-neutral-500 sm:inline">
              AT thru-hike weather planner
            </span>
          </h1>
          <nav className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm">
            {(["timeline", "map", "gear"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`rounded-md px-3 py-1.5 capitalize ${
                  tab === t
                    ? "bg-white font-medium shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* The map tab pairs map + chart side by side on desktop and needs the width. */}
      <main className={`mx-auto ${tab === "map" ? "max-w-7xl" : "max-w-3xl"} px-4 py-4`}>
        {tab === "timeline" ? (
          <TimelineView />
        ) : tab === "map" ? (
          <Suspense
            fallback={<p className="p-4 text-sm text-neutral-500">Loading map…</p>}
          >
            <MapView />
          </Suspense>
        ) : (
          <GearView />
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-6 text-xs text-neutral-500">
        <p>
          Temperatures are 1991–2020 historical normals (NOAA data via RCC-ACIS),
          corrected from each weather station to the trail's elevation at 3.5°F per
          1,000 ft. They describe <span className="font-medium">typical</span>{" "}
          conditions for a date — <span className="font-medium">not a forecast</span>.
          Any given week can be far colder, hotter, or wetter. Elevations from USGS 3DEP.
        </p>
      </footer>
    </div>
  );
}
