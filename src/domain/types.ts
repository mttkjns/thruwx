/**
 * ThruWx domain model.
 *
 * The single source of truth for the app's data shapes. Pure types only — no logic,
 * no React. Three layers, kept deliberately separate:
 *
 *   1. STATIC DATA      — shipped with the app (waypoints.json) or generated at build
 *                         time (climate.json). Never mutated at runtime.
 *   2. USER PLAN        — the only thing that is persisted (localStorage). Represents
 *                         user *intent*: dates, pace, gear, swaps.
 *   3. DERIVED          — recomputed from (1) + (2) on demand. NEVER persisted. If you
 *                         find yourself storing a Projection, stop.
 *
 * See docs/PRD.md and CLAUDE.md for the reasoning behind these shapes.
 */

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/** Calendar date, ISO 8601 "YYYY-MM-DD", no time component. */
export type IsoDate = string;

/** Full ISO 8601 timestamp, e.g. "2026-03-15T11:42:00.000Z". Used for sun times. */
export type IsoDateTime = string;

// String-alias IDs. Aliased for readability at reference sites; all are plain strings.
export type WaypointId = string;
export type StationId = string;
export type GearItemId = string;

/**
 * Day-of-year index into a station's normals array.
 *
 * CONVENTION (must match the pipeline and the dayOfYear helper exactly):
 * a normals array has 366 entries representing the days of a *leap* year,
 * Jan 1 (index 0) … Dec 31 (index 365), with Feb 29 occupying index 59.
 * Mapping a real calendar date to this index is the job of a domain helper;
 * non-leap-year dates on/after Mar 1 must be shifted to align to the leap layout.
 * Getting this wrong silently offsets every temperature by a day — test it.
 */
export type DayOfYearIndex = number; // 0..365

/* ------------------------------------------------------------------ */
/* Layer 1: static data                                                */
/* ------------------------------------------------------------------ */

/**
 * A curated point on the trail — a resupply town or a climate-significant
 * high/low point. Loaded from src/data/waypoints.json, ordered by trailMile.
 *
 * `trailElevationFt` is the elevation of the TRAIL at this point (often a gap or
 * ridge), NOT the town in the valley — that distinction is the whole point of the
 * elevation correction. `lat`/`lng` are the town/access point (fine for sun/moon and
 * for station assignment).
 */
export interface Waypoint {
  id: WaypointId;
  name: string;
  /** Two-letter US state/territory postal code, e.g. "NC". */
  state: string;
  /** Northbound trail mile, 0 at Springer Mtn. Strictly increasing across the list. */
  trailMile: number;
  lat: number;
  lng: number;
  /** Elevation of the trail here, in feet. Approximate in the starter data. */
  trailElevationFt: number;
  /** True for towns where a hiker can resupply; false for pure climate/terminus points. */
  isResupply: boolean;
  /**
   * Assigned ACIS station id (key into ClimateData). `null` until the Phase 2 pipeline
   * resolves the nearest suitable station via StnMeta. A null station means no weather
   * can be shown for this waypoint yet.
   */
  stationId: StationId | null;
  /** Elevation of the assigned station, in feet. `null` until assigned. Needed for the
   *  lapse correction (station → trail). */
  stationElevationFt: number | null;
  /** Free-text curation notes (e.g. "trail crosses at a high gap; town sits lower"). */
  notes?: string;
}

/**
 * Historical climate normal for one station on one canonical day-of-year.
 * Computed by the build pipeline from ~30 years of raw daily data (target window
 * 1991–2020), NOT taken from ACIS's built-in normal flag. All fields always present.
 */
export interface DailyNormal {
  /** Mean daily maximum temperature, °F. */
  normalMaxF: number;
  /** Mean daily minimum temperature, °F. */
  normalMinF: number;
  /** Mean daily precipitation, inches. */
  normalPrecipIn: number;
  /** Fraction of years [0..1] in which the min temp was ≤ 32°F on this day. */
  freezeProbability: number;
  /** Fraction of years [0..1] in which measurable precipitation fell on this day. */
  precipProbability: number;
}

/**
 * The full climate dataset, generated to src/data/climate.json.
 * Keyed by station id; each value is a 366-length array indexed per DayOfYearIndex.
 */
export type ClimateData = Record<StationId, DailyNormal[]>;

/**
 * Trail elevation along the whole AT, generated to src/data/profile.json by
 * scripts/build-profile.ts. Samples every `stepMi` NOBO trail miles, plus every
 * waypoint's exact trailElevationFt; miles strictly increasing. Derived from
 * OpenStreetMap geometry, so the file is ODbL (credit OSM contributors).
 */
export interface ElevationProfile {
  source: string;
  license: string;
  /** Build date, IsoDate. */
  generated: IsoDate;
  stepMi: number;
  /** [trailMile, elevationFt] pairs in ascending trailMile. */
  samples: [number, number][];
}

/* ------------------------------------------------------------------ */
/* Layer 2: user plan (the ONLY persisted state)                       */
/* ------------------------------------------------------------------ */

/**
 * Hike direction. NOBO: mile 0 (Springer, GA) → Katahdin. SOBO: Katahdin →
 * Springer; miles hiked = totalMiles − trailMile. Flip-flop is post-MVP.
 */
export type HikeDirection = "NOBO" | "SOBO";

/**
 * Suggested grouping for UI; not enforced as an exhaustive list — treat unknown values
 * as "other" rather than erroring. Extend freely.
 */
export type GearCategory =
  | "insulation"
  | "sleep"
  | "shelter"
  | "layers"
  | "footwear"
  | "accessories"
  | "other";

/**
 * A piece of gear the hiker is tracking.
 *
 * `comfortThresholdF` is OPTIONAL and drives the *optional* swap suggestions: if set,
 * the app can suggest where to add/remove this item based on projected corrected lows
 * crossing the threshold. If absent, the item is managed purely by hand and never
 * generates a suggestion.
 */
export interface GearItem {
  id: GearItemId;
  name: string;
  category: GearCategory;
  /** Comfort floor, °F: the corrected low at/below which the hiker wants this item.
   *  Undefined = no automatic suggestions for this item. */
  comfortThresholdF?: number;
  notes?: string;
}

/**
 * A user-placed gear change at a resupply waypoint. Represents user intent and is
 * persisted. Distinct from SuggestedSwap (derived, advisory) below.
 */
export interface GearSwap {
  id: string;
  /** Must reference a Waypoint with isResupply === true. */
  waypointId: WaypointId;
  addItemIds: GearItemId[];
  removeItemIds: GearItemId[];
}

/**
 * A suggested swap the user chose to ignore. Matches a SuggestedSwap by item,
 * action, and town; if the plan changes and the suggestion moves to another
 * town, it shows again (it is a different recommendation).
 */
export interface IgnoredSuggestion {
  itemId: GearItemId;
  action: SwapAction;
  waypointId: WaypointId;
  /** Removed from the suggestions list (still restorable). Absent = shown greyed out. */
  hidden?: boolean;
}

/**
 * The complete, persisted plan. This is what gets written to localStorage and what
 * export/import reads and writes. Keep it JSON-serializable (no Date objects — use
 * IsoDate strings) and free of any derived values.
 */
export interface TripPlan {
  /** Bump when the shape changes so import can validate/migrate old plans. */
  schemaVersion: number;
  /** Optional user-facing label for the plan. */
  name?: string;
  startDate: IsoDate;
  direction: HikeDirection;
  /**
   * Optional section endpoints. Absent (or unknown) = the trail terminus for
   * this direction: Springer→Katahdin for NOBO, Katahdin→Springer for SOBO.
   * End must lie beyond start in the hike direction; see hikeSection().
   */
  startWaypointId?: WaypointId;
  endWaypointId?: WaypointId;
  /** Average pace; single value for MVP. Per-section pace is post-MVP. */
  paceMilesPerDay: number;
  gear: GearItem[];
  swaps: GearSwap[];
  /** Suggestions the user dismissed. Absent = none. */
  ignoredSuggestions?: IgnoredSuggestion[];
}

/* ------------------------------------------------------------------ */
/* Layer 3: derived (recomputed, NEVER persisted)                      */
/* ------------------------------------------------------------------ */

/**
 * Elevation-corrected weather for a waypoint on the projected arrival date.
 * Raw station values are retained so the UI can show its work ("38°F on the ridge,
 * corrected from 50°F in town, 3,400 ft lower").
 */
export interface WaypointWeather {
  /** Raw station normals before correction (for the explain-the-correction UI). */
  stationMaxF: number;
  stationMinF: number;
  /** Elevation-corrected normals actually experienced on the trail. */
  correctedMaxF: number;
  correctedMinF: number;
  /** trailElevationFt − stationElevationFt (positive = trail above station). */
  elevationDeltaFt: number;
  precipIn: number;
  freezeProbability: number;
  precipProbability: number;
}

export type MoonPhaseName =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

export interface SunInfo {
  sunrise: IsoDateTime;
  sunset: IsoDateTime;
  dayLengthHours: number;
}

export interface MoonInfo {
  /** Phase as a fraction of the cycle [0..1], 0/1 = new, 0.5 = full. */
  phase: number;
  /** Illuminated fraction of the disk [0..1]. */
  illumination: number;
  phaseName: MoonPhaseName;
}

/**
 * Everything derived for a single waypoint on the projected schedule.
 * `weather` is null when the waypoint has no assigned station yet (stationId === null).
 */
export interface WaypointProjection {
  waypointId: WaypointId;
  arrivalDate: IsoDate;
  /** Whole days since startDate (0 at the first waypoint of the hike). */
  dayOfHike: number;
  weather: WaypointWeather | null;
  sun: SunInfo;
  moon: MoonInfo;
}

export type SwapAction = "add" | "remove";

/**
 * A computed suggestion to swap a gear item, produced only for items that have a
 * comfortThresholdF. Advisory: rendered distinctly from user swaps and never auto-applied.
 */
export interface SuggestedSwap {
  itemId: GearItemId;
  action: SwapAction;
  /** The resupply waypoint where the swap is recommended to happen. */
  waypointId: WaypointId;
  /** The waypoint where the corrected low actually crosses the threshold. */
  triggerWaypointId: WaypointId;
  thresholdF: number;
  /** The corrected low at the trigger point that caused the crossing. */
  crossedTempF: number;
  /** Human-readable rationale for the UI. */
  reason: string;
}

/**
 * The full derived view the UI consumes. Rebuilt whenever the plan or inputs change.
 * Not persisted.
 */
export interface Projection {
  waypoints: WaypointProjection[];
  suggestedSwaps: SuggestedSwap[];
  finishDate: IsoDate;
  /** Whole days from start to the final waypoint. */
  totalDays: number;
}
