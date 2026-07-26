import { TripSetup } from "../components/TripSetup";
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
      <TripSetup />

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

      <p className="px-1 pb-4 text-xs text-neutral-500">
        Temperatures are 1991–2020 historical normals, corrected from each weather
        station to the trail's elevation. Typical conditions, not a forecast.
      </p>
    </div>
  );
}
