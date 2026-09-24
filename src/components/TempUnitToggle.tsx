import type { TempUnit } from "../domain/units";
import { useUnitsStore } from "../state/unitsStore";

/** Header control: °F | °C. A display preference only; the plan stays in °F. */
export function TempUnitToggle() {
  const unit = useUnitsStore((s) => s.temp);
  const setTemp = useUnitsStore((s) => s.setTemp);
  return (
    <div role="group" aria-label="Temperature unit" className="flex gap-0.5 rounded-lg bg-neutral-100 p-1 text-sm">
      {(["F", "C"] as TempUnit[]).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          className={`rounded-md px-2 py-1.5 ${
            unit === u ? "bg-white font-medium shadow-sm" : "text-neutral-600 hover:text-neutral-900"
          }`}
          onClick={() => setTemp(u)}
        >
          °{u}
        </button>
      ))}
    </div>
  );
}
