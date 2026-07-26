/**
 * Threshold-based gear-swap suggestions (PRD §6).
 *
 * For each gear item with a comfortThresholdF, walk the projected waypoints in
 * trail order and find where the corrected normal LOW crosses the threshold:
 *
 *   - downward crossing (lows drop to/below threshold) → suggest ADD at the
 *     last resupply town strictly before the crossing;
 *   - upward crossing (lows rise above threshold) → suggest REMOVE at the
 *     first resupply town at/after the crossing.
 *
 * Suggestions are advisory and never auto-applied. Items without a threshold
 * produce none.
 *
 * Waypoints without weather (no station) can't trigger a crossing — the walk
 * compares each known low against the PREVIOUS known low — but they still
 * count as placement sites: you can pick up a jacket in a town we have no
 * normals for.
 *
 * Edge: if a downward crossing happens before any resupply town, the item
 * belongs in the initial loadout — that's not a swap, so no suggestion.
 */
import type {
  GearItem,
  SuggestedSwap,
  TripPlan,
  Waypoint,
  WaypointProjection,
} from "./types";

interface Point {
  waypointId: string;
  name: string;
  isResupply: boolean;
  /** Corrected normal low, or null when the waypoint has no weather. */
  correctedMinF: number | null;
}

function suggestForItem(item: GearItem, points: Point[]): SuggestedSwap[] {
  const thresholdF = item.comfortThresholdF;
  if (thresholdF === undefined) return [];

  const out: SuggestedSwap[] = [];
  let prevKnownCold: boolean | null = null; // state at the last waypoint with data

  for (let i = 0; i < points.length; i++) {
    const low = points[i].correctedMinF;
    if (low === null) continue;
    const cold = low <= thresholdF;

    if (prevKnownCold !== null && cold !== prevKnownCold) {
      const cur = points[i];
      if (cold) {
        // Downward crossing at `cur`: add at the last resupply before it.
        const at = points
          .slice(0, i)
          .reverse()
          .find((p) => p.isResupply);
        if (at) {
          out.push({
            itemId: item.id,
            action: "add",
            waypointId: at.waypointId,
            triggerWaypointId: cur.waypointId,
            thresholdF,
            crossedTempF: low,
            reason:
              `Lows drop to ${Math.round(low)}°F at ${cur.name} ` +
              `(≤ ${thresholdF}°F threshold) — pick up “${item.name}” in ${at.name}.`,
          });
        }
      } else {
        // Upward crossing at `cur`: remove at the first resupply at/after it.
        const at = points.slice(i).find((p) => p.isResupply);
        if (at) {
          out.push({
            itemId: item.id,
            action: "remove",
            waypointId: at.waypointId,
            triggerWaypointId: cur.waypointId,
            thresholdF,
            crossedTempF: low,
            reason:
              `Lows rise to ${Math.round(low)}°F by ${cur.name} ` +
              `(> ${thresholdF}°F threshold) — send “${item.name}” home from ${at.name}.`,
          });
        }
      }
    }
    prevKnownCold = cold;
  }
  return out;
}

export function suggestSwaps(
  plan: TripPlan,
  projectedWaypoints: WaypointProjection[],
  waypoints: Waypoint[],
): SuggestedSwap[] {
  const byId = new Map(waypoints.map((w) => [w.id, w]));

  const points: Point[] = projectedWaypoints.flatMap((pw) => {
    const wp = byId.get(pw.waypointId);
    if (!wp) return [];
    return [
      {
        waypointId: pw.waypointId,
        name: wp.name,
        isResupply: wp.isResupply,
        correctedMinF: pw.weather?.correctedMinF ?? null,
      },
    ];
  });

  return plan.gear.flatMap((item) => suggestForItem(item, points));
}
