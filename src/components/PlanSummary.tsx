import { usePlanStore } from "../state/planStore";
import { useProjection, WAYPOINTS } from "../state/useProjection";
import { fmtApproxMonths, fmtDate } from "./format";

const NAME_BY_ID = new Map(WAYPOINTS.map((w) => [w.id, w.name]));

/**
 * One-line header for the currently planned timeline. Shared across tabs so
 * the map and gear views always say which plan they're showing.
 */
export function PlanSummary() {
  const plan = usePlanStore((s) => s.plan);
  const projection = useProjection();

  const last = projection.waypoints[projection.waypoints.length - 1];
  const destination = NAME_BY_ID.get(last.waypointId) ?? "the far terminus";

  return (
    <p className="px-1 text-sm text-neutral-600">
      Start{" "}
      <span className="font-medium text-neutral-900">{fmtDate(plan.startDate)}</span> at{" "}
      {plan.paceMilesPerDay} mi/day {plan.direction} → reach {destination}{" "}
      <span className="font-medium text-neutral-900">{fmtDate(projection.finishDate)}</span>{" "}
      (day {projection.totalDays}, {fmtApproxMonths(projection.totalDays)}).
    </p>
  );
}
