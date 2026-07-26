import { LoadClimateCard } from "../components/LoadClimateCard";
import { TripSetup } from "../components/TripSetup";
import { WelcomeBanner } from "../components/WelcomeBanner";
import { WaypointRow } from "../components/WaypointRow";
import { fmtDate } from "../components/format";
import { usePlanStore } from "../state/planStore";
import { useProjection, WAYPOINTS } from "../state/useProjection";

/** The hero view: the whole hike as a weather timeline. */
export function TimelineView() {
  const plan = usePlanStore((s) => s.plan);
  const projection = useProjection();

  return (
    <div className="space-y-4">
      <WelcomeBanner />
      <TripSetup />
      <LoadClimateCard />

      <p className="px-1 text-sm text-neutral-600">
        Start <span className="font-medium text-neutral-900">{fmtDate(plan.startDate)}</span>{" "}
        at {plan.paceMilesPerDay} mi/day → summit Katahdin{" "}
        <span className="font-medium text-neutral-900">{fmtDate(projection.finishDate)}</span>{" "}
        (day {projection.totalDays}).
      </p>

      <ol className="space-y-3">
        {WAYPOINTS.map((wp, i) => (
          <WaypointRow key={wp.id} waypoint={wp} projection={projection.waypoints[i]} />
        ))}
      </ol>

    </div>
  );
}
