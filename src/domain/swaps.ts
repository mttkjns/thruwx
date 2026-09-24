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
 * FLAP GUARD: normals in the southern highlands hover around common
 * thresholds for weeks, which produces add/remove/add chains if every raw
 * crossing counts. A crossing is only honored when the new state SUSTAINS for
 * at least SUSTAIN_DAYS of projected hiking — every weather-bearing waypoint
 * within that window must agree with the new state. Blips shorter than the
 * window are ignored and the previous state stands.
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
 *
 * Two clean-up rules run on each item's suggestions, in this order:
 *
 *   1. SAME-DAY CANCEL: a suggestion followed by the opposite one for the same
 *      item on the same projected day or earlier cancels out — e.g. "send home
 *      from Monson" then "pick up in Monson" (lows rise, then drop again
 *      before the finish, with no resupply between). Drop both: the hiker
 *      just keeps carrying it (or never picks it up).
 *   2. NO TERMINUS SWAPS: nothing is suggested at the first or last waypoint
 *      of the hike. A pick-up at the start is the initial loadout, and a
 *      send-home at the finish is pointless.
 */
import type {
  GearItem,
  IgnoredSuggestion,
  SuggestedSwap,
  TripPlan,
  Waypoint,
  WaypointProjection,
} from "./types";
import { toUnit, type TempUnit } from "./units";

/** A state flip must hold this many projected days to count as a crossing. */
export const SUSTAIN_DAYS = 7;

interface Placed {
  suggestion: SuggestedSwap;
  /** Projected day at the placement town, for same-day cancelling. */
  dayOfHike: number;
  /** Index of the placement town in the hike-ordered points. */
  index: number;
}

interface Point {
  waypointId: string;
  name: string;
  isResupply: boolean;
  dayOfHike: number;
  /** Corrected normal low, or null when the waypoint has no weather. */
  correctedMinF: number | null;
}

/**
 * True when every weather-bearing point within SUSTAIN_DAYS after points[i]
 * (inclusive) agrees with `cold`. An empty lookahead (end of trail) defers to
 * point i itself.
 */
function sustains(points: Point[], i: number, cold: boolean, thresholdF: number): boolean {
  const until = points[i].dayOfHike + SUSTAIN_DAYS;
  for (let j = i + 1; j < points.length; j++) {
    const p = points[j];
    if (p.dayOfHike > until) break;
    if (p.correctedMinF === null) continue;
    if (p.correctedMinF <= thresholdF !== cold) return false;
  }
  return true;
}

function suggestForItem(item: GearItem, points: Point[]): SuggestedSwap[] {
  const thresholdF = item.comfortThresholdF;
  if (thresholdF === undefined) return [];

  const out: Placed[] = [];
  let committed: boolean | null = null; // cold-state at the last honored point

  for (let i = 0; i < points.length; i++) {
    const low = points[i].correctedMinF;
    if (low === null) continue;
    const cold = low <= thresholdF;

    if (committed === null) {
      committed = cold;
      continue;
    }
    if (cold === committed || !sustains(points, i, cold, thresholdF)) continue;

    const cur = points[i];
    if (cold) {
      // Downward crossing at `cur`: add at the last resupply before it.
      let atIndex = i - 1;
      while (atIndex >= 0 && !points[atIndex].isResupply) atIndex--;
      const at = points[atIndex];
      if (at) {
        out.push({ dayOfHike: at.dayOfHike, index: atIndex, suggestion: {
          itemId: item.id,
          action: "add",
          waypointId: at.waypointId,
          triggerWaypointId: cur.waypointId,
          thresholdF,
          crossedTempF: low,
        } });
      }
    } else {
      // Upward crossing at `cur`: remove at the first resupply at/after it.
      let atIndex = i;
      while (atIndex < points.length && !points[atIndex].isResupply) atIndex++;
      const at = points[atIndex];
      if (at) {
        out.push({ dayOfHike: at.dayOfHike, index: atIndex, suggestion: {
          itemId: item.id,
          action: "remove",
          waypointId: at.waypointId,
          triggerWaypointId: cur.waypointId,
          thresholdF,
          crossedTempF: low,
        } });
      }
    }
    committed = cold;
  }

  // 1. Same-day cancel. Actions alternate per item, so a stack pairs each
  // suggestion with the opposite one before it.
  const kept: Placed[] = [];
  for (const p of out) {
    const prev = kept[kept.length - 1];
    if (prev && prev.suggestion.action !== p.suggestion.action && p.dayOfHike <= prev.dayOfHike) {
      kept.pop();
      continue;
    }
    kept.push(p);
  }

  // 2. No swaps at the start or finish of the hike.
  const lastIndex = points.length - 1;
  return kept
    .filter((p) => p.index !== 0 && p.index !== lastIndex)
    .map((p) => p.suggestion);
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
        dayOfHike: pw.dayOfHike,
        correctedMinF: pw.weather?.correctedMinF ?? null,
      },
    ];
  });

  return plan.gear.flatMap((item) => suggestForItem(item, points));
}

/** True when the user has ignored this exact suggestion (same item, action, and town). */
export function isSuggestionIgnored(plan: TripPlan, suggestion: SuggestedSwap): boolean {
  return (plan.ignoredSuggestions ?? []).some((ig) => sameSuggestion(ig, suggestion));
}

/** True when the user ignored this suggestion and then removed it from the list. */
export function isSuggestionHidden(plan: TripPlan, suggestion: SuggestedSwap): boolean {
  return (plan.ignoredSuggestions ?? []).some((ig) => ig.hidden === true && sameSuggestion(ig, suggestion));
}

export function sameSuggestion(
  a: Omit<IgnoredSuggestion, "hidden">,
  b: Omit<IgnoredSuggestion, "hidden">,
): boolean {
  return a.itemId === b.itemId && a.action === b.action && a.waypointId === b.waypointId;
}

/**
 * The human-readable rationale for a suggestion, in the viewer's temperature
 * unit. Built at display time (not stored on the suggestion) so the unit
 * toggle applies; names are passed in because the suggestion carries ids.
 */
export function describeSuggestion(
  s: SuggestedSwap,
  names: { item: string; trigger: string; at: string },
  unit: TempUnit = "F",
): string {
  const deg = (f: number) => `${Math.round(toUnit(f, unit)) + 0}°${unit}`;
  return s.action === "add"
    ? `Lows drop to ${deg(s.crossedTempF)} at ${names.trigger} ` +
        `(≤ ${deg(s.thresholdF)} threshold) — pick up “${names.item}” in ${names.at}.`
    : `Lows rise to ${deg(s.crossedTempF)} by ${names.trigger} ` +
        `(> ${deg(s.thresholdF)} threshold) — send “${names.item}” home from ${names.at}.`;
}
