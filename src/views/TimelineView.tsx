import { LoadClimateCard } from "../components/LoadClimateCard";
import { TripSetup } from "../components/TripSetup";
import { WelcomeBanner } from "../components/WelcomeBanner";
import { WaypointRow } from "../components/WaypointRow";
import { fmtDate } from "../components/format";
import { usePlanStore } from "../state/planStore";
import { useProjection, WAYPOINTS } from "../state/useProjection";

const WAYPOINTS_BY_ID = new Map(WAYPOINTS.map((w) => [w.id, w]));

/** The hero view: the whole hike as a weather timeline, in hike order. */
export function TimelineView() {
  const plan = usePlanStore((s) => s.plan);
  const projection = useProjection();

  const last = projection.waypoints[projection.waypoints.length - 1];
  const destination = WAYPOINTS_BY_ID.get(last.waypointId)?.name ?? "the far terminus";

  return (
    <div className="space-y-4">
      <WelcomeBanner />
      <TripSetup />
      <LoadClimateCard />

      <p className="px-1 text-sm text-neutral-600">
        Start <span className="font-medium text-neutral-900">{fmtDate(plan.startDate)}</span>{" "}
        at {plan.paceMilesPerDay} mi/day {plan.direction} → reach {destination}{" "}
        <span className="font-medium text-neutral-900">{fmtDate(projection.finishDate)}</span>{" "}
        (day {projection.totalDays}).
      </p>

      <ol className="space-y-3">
        {projection.waypoints.map((pw) => (
          <WaypointRow
            key={pw.waypointId}
            waypoint={WAYPOINTS_BY_ID.get(pw.waypointId)!}
            projection={pw}
          />
        ))}
      </ol>
    </div>
  );
}
