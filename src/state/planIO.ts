/**
 * Export/import of the plan as a JSON file. Serialization is pure and tested;
 * the two DOM helpers (download trigger, file read) are thin browser glue.
 */
import { validateTripPlan, type PlanValidation } from "../domain/plan";
import type { TripPlan } from "../domain/types";

export function serializePlan(plan: TripPlan): string {
  return JSON.stringify(plan, null, 2) + "\n";
}

/** Parse untrusted file text into a validated plan (or errors). */
export function parsePlanJson(text: string): PlanValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["File is not valid JSON."] };
  }
  return validateTripPlan(raw);
}

export function planFileName(plan: TripPlan): string {
  const label = (plan.name ?? "ridgeline-plan")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${label || "ridgeline-plan"}-${plan.startDate}.json`;
}

/** Trigger a browser download of the plan. Browser-only. */
export function downloadPlan(plan: TripPlan): void {
  const blob = new Blob([serializePlan(plan)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = planFileName(plan);
  a.click();
  URL.revokeObjectURL(url);
}

/** Read a user-chosen file into text. Browser-only. */
export function readPlanFile(file: File): Promise<string> {
  return file.text();
}
