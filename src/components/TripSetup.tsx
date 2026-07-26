import { useRef, useState } from "react";
import { planWarnings } from "../domain/plan";
import { downloadPlan, parsePlanJson } from "../state/planIO";
import { usePlanStore } from "../state/planStore";
import { useProjection } from "../state/useProjection";

/** Start date + pace, plus plan portability (export / import / reset). */
export function TripSetup() {
  const plan = usePlanStore((s) => s.plan);
  const setStartDate = usePlanStore((s) => s.setStartDate);
  const setPace = usePlanStore((s) => s.setPace);
  const importPlan = usePlanStore((s) => s.importPlan);
  const resetPlan = usePlanStore((s) => s.resetPlan);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const projection = useProjection();
  const warnings = planWarnings(plan, projection.finishDate);

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    const parsed = parsePlanJson(await file.text());
    if (!parsed.ok) {
      setImportErrors(parsed.errors);
      return;
    }
    const result = importPlan(parsed.plan);
    setImportErrors(result.ok ? [] : result.errors);
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block text-sm text-neutral-700">
          Start date
          <input
            type="date"
            className="mt-1 block rounded-md border border-neutral-300 p-2"
            value={plan.startDate}
            onChange={(e) => e.target.value && setStartDate(e.target.value)}
          />
        </label>
        <label className="block text-sm text-neutral-700">
          Pace (mi/day)
          <input
            type="number"
            min={1}
            max={40}
            step={0.5}
            className="mt-1 block w-24 rounded-md border border-neutral-300 p-2"
            value={plan.paceMilesPerDay}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) setPace(v);
            }}
          />
        </label>

        <div className="ml-auto flex gap-2 text-sm">
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-2 hover:bg-neutral-50"
            onClick={() => downloadPlan(plan)}
          >
            Export
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-2 hover:bg-neutral-50"
            onClick={() => fileInput.current?.click()}
          >
            Import
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-2 text-red-700 hover:bg-red-50"
            onClick={() => {
              if (window.confirm("Reset the plan? Gear and swaps will be lost.")) {
                resetPlan();
              }
            }}
          >
            Reset
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void onImportFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {importErrors.length > 0 && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Couldn’t import that file:</p>
          <ul className="mt-1 list-inside list-disc">
            {importErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
