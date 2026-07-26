/**
 * TripPlan construction and validation — pure functions, used by the store's
 * import path and by first-run initialization.
 */
import type { GearCategory, TripPlan } from "./types";

/** Bump when TripPlan's persisted shape changes; migrate on import/rehydrate. */
export const PLAN_SCHEMA_VERSION = 1;

const GEAR_CATEGORIES: GearCategory[] = [
  "insulation",
  "sleep",
  "shelter",
  "layers",
  "footwear",
  "accessories",
  "other",
];

/** Upcoming March 1 — the archetypal NOBO start — as a friendly default. */
export function defaultStartDate(today: Date = new Date()): string {
  const year = today.getUTCFullYear();
  const marchFirst = `${year}-03-01`;
  const todayIso = today.toISOString().slice(0, 10);
  return todayIso <= marchFirst ? marchFirst : `${year + 1}-03-01`;
}

export function createDefaultPlan(today: Date = new Date()): TripPlan {
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    startDate: defaultStartDate(today),
    direction: "NOBO",
    paceMilesPerDay: 15,
    gear: [],
    swaps: [],
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export type PlanValidation =
  | { ok: true; plan: TripPlan }
  | { ok: false; errors: string[] };

/**
 * Validate untrusted input (imported JSON) into a TripPlan. Collects every
 * error rather than stopping at the first, so the user can fix a file in one
 * pass. Unknown gear categories are coerced to "other" (types.ts says treat
 * unknown values as other, not an error); unknown extra fields are dropped.
 */
export function validateTripPlan(input: unknown): PlanValidation {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["Plan must be a JSON object."] };
  }
  const raw = input as Record<string, unknown>;

  if (raw.schemaVersion !== PLAN_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PLAN_SCHEMA_VERSION}.`);
  }
  if (!isValidIsoDate(raw.startDate)) {
    errors.push("startDate must be a valid YYYY-MM-DD date.");
  }
  if (raw.direction !== "NOBO") {
    errors.push('direction must be "NOBO" (only NOBO is supported).');
  }
  const pace = raw.paceMilesPerDay;
  if (typeof pace !== "number" || !Number.isFinite(pace) || pace <= 0 || pace > 60) {
    errors.push("paceMilesPerDay must be a number between 0 and 60.");
  }
  if (raw.name !== undefined && typeof raw.name !== "string") {
    errors.push("name must be a string when present.");
  }

  const gear: TripPlan["gear"] = [];
  if (!Array.isArray(raw.gear)) {
    errors.push("gear must be an array.");
  } else {
    raw.gear.forEach((g, i) => {
      if (typeof g !== "object" || g === null) {
        errors.push(`gear[${i}] must be an object.`);
        return;
      }
      const item = g as Record<string, unknown>;
      if (typeof item.id !== "string" || item.id === "") {
        errors.push(`gear[${i}].id must be a non-empty string.`);
        return;
      }
      if (typeof item.name !== "string" || item.name === "") {
        errors.push(`gear[${i}].name must be a non-empty string.`);
        return;
      }
      if (
        item.comfortThresholdF !== undefined &&
        (typeof item.comfortThresholdF !== "number" ||
          !Number.isFinite(item.comfortThresholdF))
      ) {
        errors.push(`gear[${i}].comfortThresholdF must be a number when present.`);
        return;
      }
      if (item.notes !== undefined && typeof item.notes !== "string") {
        errors.push(`gear[${i}].notes must be a string when present.`);
        return;
      }
      const category = GEAR_CATEGORIES.includes(item.category as GearCategory)
        ? (item.category as GearCategory)
        : "other";
      gear.push({
        id: item.id,
        name: item.name,
        category,
        ...(item.comfortThresholdF !== undefined
          ? { comfortThresholdF: item.comfortThresholdF as number }
          : {}),
        ...(item.notes !== undefined ? { notes: item.notes as string } : {}),
      });
    });
    const ids = new Set(gear.map((g) => g.id));
    if (ids.size !== gear.length) errors.push("gear ids must be unique.");
  }

  const swaps: TripPlan["swaps"] = [];
  if (!Array.isArray(raw.swaps)) {
    errors.push("swaps must be an array.");
  } else {
    const gearIds = new Set(gear.map((g) => g.id));
    raw.swaps.forEach((s, i) => {
      if (typeof s !== "object" || s === null) {
        errors.push(`swaps[${i}] must be an object.`);
        return;
      }
      const swap = s as Record<string, unknown>;
      if (typeof swap.id !== "string" || swap.id === "") {
        errors.push(`swaps[${i}].id must be a non-empty string.`);
        return;
      }
      if (typeof swap.waypointId !== "string" || swap.waypointId === "") {
        errors.push(`swaps[${i}].waypointId must be a non-empty string.`);
        return;
      }
      for (const key of ["addItemIds", "removeItemIds"] as const) {
        const list = swap[key];
        if (!Array.isArray(list) || list.some((x) => typeof x !== "string")) {
          errors.push(`swaps[${i}].${key} must be an array of strings.`);
          return;
        }
        for (const id of list as string[]) {
          if (!gearIds.has(id)) {
            errors.push(`swaps[${i}].${key} references unknown gear id "${id}".`);
          }
        }
      }
      swaps.push({
        id: swap.id,
        waypointId: swap.waypointId,
        addItemIds: swap.addItemIds as string[],
        removeItemIds: swap.removeItemIds as string[],
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    plan: {
      schemaVersion: PLAN_SCHEMA_VERSION,
      ...(typeof raw.name === "string" ? { name: raw.name } : {}),
      startDate: raw.startDate as string,
      direction: "NOBO",
      paceMilesPerDay: pace as number,
      gear,
      swaps,
    },
  };
}
