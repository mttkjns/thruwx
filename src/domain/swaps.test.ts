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

const proj = (
  waypointId: string,
  low: number | null,
  dayOfHike: number,
): WaypointProjection => ({
  waypointId,
  arrivalDate: "2026-04-01",
  dayOfHike,
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
  // (up-crossing) → cold northern mountains (second down-crossing). Waypoints
  // are spaced >SUSTAIN_DAYS apart so every crossing sustains.
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
  const projected = waypoints.map((w, i) => proj(w.id, lows[i], i * 10));

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
    const coldProj = [proj("start", 20, 0), proj("townA", 25, 10)];
    expect(suggestSwaps(plan([puffy]), coldProj, coldStart)).toEqual([]);
  });

  it("skips waypoints without weather instead of treating them as warm", () => {
    // start warm → gap (no station) → cold town. Crossing detected at townB,
    // add at the last resupply with data before it.
    const wps = [wp("start", true), wp("gap", false), wp("townB", true)];
    const projs = [proj("start", 40, 0), proj("gap", null, 5), proj("townB", 25, 10)];
    const swaps = suggestSwaps(plan([puffy]), projs, wps);
    expect(swaps).toHaveLength(1);
    expect(swaps[0]).toMatchObject({ action: "add", waypointId: "start" });
  });

  it("threshold is inclusive: a low exactly AT the threshold counts as cold", () => {
    const wps = [wp("a", true), wp("b", true)];
    const projs = [proj("a", 31, 0), proj("b", 30, 10)];
    const swaps = suggestSwaps(plan([puffy]), projs, wps);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].action).toBe("add");
  });

  describe("flap guard (SUSTAIN_DAYS lag)", () => {
    // Warm baseline, then lows oscillating around the threshold day-to-day —
    // the southern-highlands pattern that used to emit add/remove chains.
    const flapWps = [
      wp("t0", true),
      wp("t1", true),
      wp("t2", true),
      wp("t3", true),
      wp("t4", true),
      wp("t5", true),
    ];

    it("ignores a cold blip shorter than the sustain window", () => {
      // cold at day 10 but warm again by day 13 → no crossing at all.
      const projs = [
        proj("t0", 40, 0),
        proj("t1", 28, 10), // blip
        proj("t2", 35, 13),
        proj("t3", 36, 20),
        proj("t4", 38, 30),
        proj("t5", 40, 40),
      ];
      expect(suggestSwaps(plan([puffy]), projs, flapWps)).toEqual([]);
    });

    it("honors a flip that holds for the whole window", () => {
      // cold from day 10 through day 18 (> 7 days) → one add, no flapping.
      const projs = [
        proj("t0", 40, 0),
        proj("t1", 28, 10),
        proj("t2", 25, 14),
        proj("t3", 27, 18),
        proj("t4", 20, 30),
        proj("t5", 18, 40),
      ];
      const swaps = suggestSwaps(plan([puffy]), projs, flapWps);
      expect(swaps).toHaveLength(1);
      expect(swaps[0]).toMatchObject({
        action: "add",
        waypointId: "t0",
        triggerWaypointId: "t1",
      });
    });

    it("collapses an oscillating stretch into a single crossing pair", () => {
      // cold → warm-blip → cold → sustained warm: expect exactly add + remove.
      const projs = [
        proj("t0", 40, 0),
        proj("t1", 25, 10), // sustained cold begins (t2 within window agrees)
        proj("t2", 28, 15),
        proj("t3", 35, 17), // warm blip: t4 (cold, day 20) is inside its window
        proj("t4", 26, 20),
        proj("t5", 45, 30), // sustained warm (end of trail)
      ];
      const swaps = suggestSwaps(plan([puffy]), projs, flapWps);
      expect(swaps.map((s) => s.action)).toEqual(["add", "remove"]);
      expect(swaps[1].triggerWaypointId).toBe("t5");
    });

    it("end of trail defers to the final point itself", () => {
      const projs = [proj("t0", 40, 0), proj("t1", 25, 10)];
      const swaps = suggestSwaps(plan([puffy]), projs, flapWps.slice(0, 2));
      expect(swaps).toHaveLength(1);
      expect(swaps[0].action).toBe("add");
    });
  });
});
