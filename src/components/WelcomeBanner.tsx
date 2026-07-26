import { createDefaultPlan } from "../domain/plan";
import { usePlanStore } from "../state/planStore";

/**
 * First-run guidance. Shown only while the plan is pristine (default start,
 * default pace, no gear, no swaps) — the moment the user touches anything,
 * it disappears for good. No dismissal state to persist.
 */
export function WelcomeBanner() {
  const plan = usePlanStore((s) => s.plan);
  const fresh = createDefaultPlan();

  const pristine =
    plan.gear.length === 0 &&
    plan.swaps.length === 0 &&
    plan.startDate === fresh.startDate &&
    plan.paceMilesPerDay === fresh.paceMilesPerDay;

  if (!pristine) return null;

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <h2 className="font-semibold">Plan your thru-hike in three steps</h2>
      <ol className="mt-2 list-inside list-decimal space-y-1">
        <li>
          <span className="font-medium">Set your start date and pace</span> below —
          the timeline projects where you'll be on every date of the hike.
        </li>
        <li>
          Scan the timeline: temperatures are historical normals, corrected to the
          trail's elevation (ridges run ~3.5°F colder per 1,000 ft than the towns
          where weather stations sit).
        </li>
        <li>
          Add your gear on the <span className="font-medium">Gear</span> tab with a
          comfort threshold, and ThruWx suggests which towns to swap it at.
        </li>
      </ol>
    </section>
  );
}
