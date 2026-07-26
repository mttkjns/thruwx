import { describe, expect, it } from "vitest";
import { suggestSwaps } from "./swaps";
import type {
  GearItem,
  TripPlan,
  Waypoint,
  WaypointProjection,
  WaypointWeather,
} from "./types";

/* Fixture builders ---------------------------------------------------- */

const wp = (id: string, isResupply: boolean): Waypoint => ({
  id,
  name: id.toUpperCase(),
  state: "VA",
  trailMile: 0,
  lat: 37,
  lng: -80,
  trailElevationFt: 3000,
  isResupply,
  stationId: "STN",
  stationElevationFt: 1500,
});

const weather = (correctedMinF: number): WaypointWeather => ({
  stationMaxF: 60,
  stationMinF: correctedMinF + 5.25,
  correctedMaxF: 55,
  correctedMinF,
  elevationDeltaFt: 1500,
  precipIn: 0.1,
  freezeProbability: 0.5,
  precipProbability: 0.3,
});

const proj = (waypointId: string, low: number | null): WaypointProjection => ({
  waypointId,
  arrivalDate: "2026-04-01",
  dayOfHike: 10,
  weather: low === null ? null : weather(low),
  sun: { sunrise: "", sunset: "", dayLengthHours: 12 },
  moon: { phase: 0.5, illumination: 1, phaseName: "full" },
});

const puffy: GearItem = {
  id: "puffy",
  name: "Down jacket",
  category: "insulation",
  comfortThresholdF: 30,
};

const plan = (gear: GearItem[]): TripPlan => ({
  schemaVersion: 1,
  startDate: "2026-03-01",
  direction: "NOBO",
  paceMilesPerDay: 15,
  gear,
  swaps: [],
});

/* Tests ---------------------------------------------------------------- */

describe("suggestSwaps", () => {
  // NOBO arc: warm start → cold highlands (down-crossing) → hot mid-Atlantic
  // (up-crossing) → cold northern mountains (second down-crossing).
  const waypoints = [
    wp("start", true), //   low 40  warm
    wp("townA", true), //   low 35  warm  ← add suggested here (last resupply before cold)
    wp("ridge", false), //  low 25  COLD  ← down-crossing trigger
    wp("townB", true), //   low 28  COLD
    wp("townC", true), //   low 38  warm  ← up-crossing trigger AND remove site (resupply)
    wp("townD", true), //   low 45  warm
    wp("peak", false), //   low 22  COLD  ← second down-crossing trigger
    wp("townE", true), //   low 20  COLD
  ];
  const lows = [40, 35, 25, 28, 38, 45, 22, 20];
  const projected = waypoints.map((w, i) => proj(w.id, lows[i]));

  it("suggests ADD at the last resupply before a downward crossing", () => {
    const swaps = suggestSwaps(plan([puffy]), projected, waypoints);
    const adds = swaps.filter((s) => s.action === "add");
    expect(adds).toHaveLength(2);
    expect(adds[0]).toMatchObject({
      itemId: "puffy",
      waypointId: "townA",
      triggerWaypointId: "ridge",
      thresholdF: 30,
      crossedTempF: 25,
    });
  });

  it("suggests REMOVE at the first resupply at/after an upward crossing", () => {
    const swaps = suggestSwaps(plan([puffy]), projected, waypoints);
    const removes = swaps.filter((s) => s.action === "remove");
    expect(removes).toHaveLength(1);
    expect(removes[0]).toMatchObject({
      itemId: "puffy",
      waypointId: "townC", // resupply at the crossing itself
      triggerWaypointId: "townC",
      crossedTempF: 38,
    });
  });

  it("handles the full down→up→down arc (add, remove, add again)", () => {
    const swaps = suggestSwaps(plan([puffy]), projected, waypoints);
    expect(swaps.map((s) => s.action)).toEqual(["add", "remove", "add"]);
    expect(swaps[2]).toMatchObject({ waypointId: "townD", triggerWaypointId: "peak" });
  });

  it("suggests nothing for items without a threshold", () => {
    const tarp: GearItem = { id: "tarp", name: "Tarp", category: "shelter" };
    expect(suggestSwaps(plan([tarp]), projected, waypoints)).toEqual([]);
  });

  it("suggests nothing when it is cold from the very start (initial loadout, not a swap)", () => {
    const coldStart = [wp("start", true), wp("townA", true)];
    const coldProj = [proj("start", 20), proj("townA", 25)];
    expect(suggestSwaps(plan([puffy]), coldProj, coldStart)).toEqual([]);
  });

  it("skips waypoints without weather instead of treating them as warm", () => {
    // start warm → gap (no station) → cold town. Crossing detected at townB,
    // add at the last resupply with data before it.
    const wps = [wp("start", true), wp("gap", false), wp("townB", true)];
    const projs = [proj("start", 40), proj("gap", null), proj("townB", 25)];
    const swaps = suggestSwaps(plan([puffy]), projs, wps);
    expect(swaps).toHaveLength(1);
    expect(swaps[0]).toMatchObject({ action: "add", waypointId: "start" });
  });

  it("threshold is inclusive: a low exactly AT the threshold counts as cold", () => {
    const wps = [wp("a", true), wp("b", true)];
    const projs = [proj("a", 31), proj("b", 30)];
    const swaps = suggestSwaps(plan([puffy]), projs, wps);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].action).toBe("add");
  });
});
