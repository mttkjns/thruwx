import { usePlanStore } from "./state/planStore";
import { useProjection, WAYPOINTS } from "./state/useProjection";

/**
 * Phase 4 placeholder shell: proves store → projection wiring end to end
 * (plan persists across reloads; projection is derived live). Real views
 * land in Phase 5.
 */
export default function App() {
  const plan = usePlanStore((s) => s.plan);
  const setStartDate = usePlanStore((s) => s.setStartDate);
  const setPace = usePlanStore((s) => s.setPace);
  const projection = useProjection();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold tracking-tight">Ridgeline</h1>
      <p className="mt-2 text-neutral-600">
        Typical-weather planning for an AT thru-hike. Scaffold build — the real
        UI arrives in Phase 5.
      </p>

      <div className="mt-6 flex gap-6">
        <label className="block text-sm">
          Start date
          <input
            type="date"
            className="mt-1 block rounded border border-neutral-300 p-2"
            value={plan.startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Pace (mi/day)
          <input
            type="number"
            min={1}
            max={40}
            className="mt-1 block w-24 rounded border border-neutral-300 p-2"
            value={plan.paceMilesPerDay}
            onChange={(e) => setPace(Number(e.target.value))}
          />
        </label>
      </div>

      <p className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm text-neutral-700">
        {WAYPOINTS.length} waypoints · start {plan.startDate} at{" "}
        {plan.paceMilesPerDay} mi/day → reach Katahdin {projection.finishDate}{" "}
        (day {projection.totalDays}). Plan persists in localStorage.
      </p>
    </main>
  );
}
