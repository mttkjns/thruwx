import { useState } from "react";
import { GearView } from "./views/GearView";
import { TimelineView } from "./views/TimelineView";

type Tab = "timeline" | "gear";

export default function App() {
  const [tab, setTab] = useState<Tab>("timeline");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold tracking-tight">
            Ridgeline
            <span className="ml-2 hidden text-sm font-normal text-neutral-500 sm:inline">
              AT thru-hike weather planner
            </span>
          </h1>
          <nav className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm">
            {(["timeline", "gear"] as const).map((t) => (
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

      <main className="mx-auto max-w-3xl px-4 py-4">
        {tab === "timeline" ? <TimelineView /> : <GearView />}
      </main>
    </div>
  );
}
