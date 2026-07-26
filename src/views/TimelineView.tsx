import { LoadClimateCard } from "../components/LoadClimateCard";
import { PlanSummary } from "../components/PlanSummary";
import { TripSetup } from "../components/TripSetup";
import { WelcomeBanner } from "../components/WelcomeBanner";
import { WaypointRow } from "../components/WaypointRow";
import { useProjection, WAYPOINTS } from "../state/useProjection";

const WAYPOINTS_BY_ID = new Map(WAYPOINTS.map((w) => [w.id, w]));

/** The hero view: the whole hike as a weather timeline, in hike order. */
export function TimelineView() {
  const projection = useProjection();

  return (
    <div className="space-y-4">
      <WelcomeBanner />
      <TripSetup />
      <LoadClimateCard />

      <PlanSummary />

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
