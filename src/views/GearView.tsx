import type { GearCategory, GearItem, SuggestedSwap } from "../domain/types";
import { LoadClimateCard } from "../components/LoadClimateCard";
import { fmtDate } from "../components/format";
import { useClimateStore } from "../state/climateStore";
import { usePlanStore } from "../state/planStore";
import { useProjection, WAYPOINTS } from "../state/useProjection";

const CATEGORIES: GearCategory[] = [
  "insulation",
  "sleep",
  "shelter",
  "layers",
  "footwear",
  "accessories",
  "other",
];

const RESUPPLY_WAYPOINTS = WAYPOINTS.filter((w) => w.isResupply);
const waypointName = (id: string) =>
  WAYPOINTS.find((w) => w.id === id)?.name ?? id;

/* ------------------------------------------------------------------ */
/* Gear items                                                          */
/* ------------------------------------------------------------------ */

function GearItemRow({ item }: { item: GearItem }) {
  const updateGearItem = usePlanStore((s) => s.updateGearItem);
  const removeGearItem = usePlanStore((s) => s.removeGearItem);

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <input
        className="w-40 grow rounded-md border border-neutral-300 p-1.5 text-sm"
        value={item.name}
        aria-label="Item name"
        onChange={(e) => updateGearItem(item.id, { name: e.target.value })}
      />
      <select
        className="rounded-md border border-neutral-300 p-1.5 text-sm"
        value={item.category}
        aria-label="Category"
        onChange={(e) =>
          updateGearItem(item.id, { category: e.target.value as GearCategory })
        }
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm text-neutral-600">
        comfort ≤
        <input
          type="number"
          className="w-16 rounded-md border border-neutral-300 p-1.5 text-sm"
          placeholder="—"
          value={item.comfortThresholdF ?? ""}
          onChange={(e) =>
            updateGearItem(item.id, {
              comfortThresholdF:
                e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
        />
        °F
      </label>
      <button
        type="button"
        className="ml-auto rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50"
        onClick={() => removeGearItem(item.id)}
      >
        Remove
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* User swaps                                                          */
/* ------------------------------------------------------------------ */

function SwapCard({ swapId }: { swapId: string }) {
  const swap = usePlanStore((s) => s.plan.swaps.find((x) => x.id === swapId))!;
  const gear = usePlanStore((s) => s.plan.gear);
  const updateSwap = usePlanStore((s) => s.updateSwap);
  const removeSwap = usePlanStore((s) => s.removeSwap);

  function setMembership(itemId: string, list: "add" | "remove" | "none") {
    updateSwap(swap.id, {
      addItemIds:
        list === "add"
          ? [...new Set([...swap.addItemIds, itemId])]
          : swap.addItemIds.filter((x) => x !== itemId),
      removeItemIds:
        list === "remove"
          ? [...new Set([...swap.removeItemIds, itemId])]
          : swap.removeItemIds.filter((x) => x !== itemId),
    });
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-600">At</span>
        <select
          className="rounded-md border border-neutral-300 p-1.5 text-sm"
          value={swap.waypointId}
          onChange={(e) => updateSwap(swap.id, { waypointId: e.target.value })}
        >
          {RESUPPLY_WAYPOINTS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} (mi {w.trailMile.toFixed(0)})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ml-auto rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50"
          onClick={() => removeSwap(swap.id)}
        >
          Delete
        </button>
      </div>

      {gear.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">Add gear items first.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-1 font-normal">item</th>
              <th className="w-20 py-1 text-center font-normal">pick up</th>
              <th className="w-20 py-1 text-center font-normal">send home</th>
            </tr>
          </thead>
          <tbody>
            {gear.map((g) => {
              const state = swap.addItemIds.includes(g.id)
                ? "add"
                : swap.removeItemIds.includes(g.id)
                  ? "remove"
                  : "none";
              return (
                <tr key={g.id} className="border-t border-neutral-100">
                  <td className="py-1.5">{g.name}</td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`Pick up ${g.name}`}
                      checked={state === "add"}
                      onChange={(e) =>
                        setMembership(g.id, e.target.checked ? "add" : "none")
                      }
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`Send home ${g.name}`}
                      checked={state === "remove"}
                      onChange={(e) =>
                        setMembership(g.id, e.target.checked ? "remove" : "none")
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

function SuggestionRow({ suggestion }: { suggestion: SuggestedSwap }) {
  const swaps = usePlanStore((s) => s.plan.swaps);
  const addSwap = usePlanStore((s) => s.addSwap);
  const updateSwap = usePlanStore((s) => s.updateSwap);
  const projection = useProjection();

  const arrival = projection.waypoints.find(
    (w) => w.waypointId === suggestion.waypointId,
  )?.arrivalDate;

  const listKey = suggestion.action === "add" ? "addItemIds" : "removeItemIds";
  const planned = swaps.some(
    (sw) =>
      sw.waypointId === suggestion.waypointId && sw[listKey].includes(suggestion.itemId),
  );
  // Same item+action placed at a DIFFERENT town = the user overrode the
  // suggestion; acknowledge it instead of nagging with an Accept button.
  const override = planned
    ? undefined
    : swaps.find((sw) => sw[listKey].includes(suggestion.itemId));

  function accept() {
    const existing = swaps.find((sw) => sw.waypointId === suggestion.waypointId);
    if (existing) {
      updateSwap(existing.id, {
        [listKey]: [...new Set([...existing[listKey], suggestion.itemId])],
      });
    } else {
      addSwap({
        waypointId: suggestion.waypointId,
        addItemIds: suggestion.action === "add" ? [suggestion.itemId] : [],
        removeItemIds: suggestion.action === "remove" ? [suggestion.itemId] : [],
      });
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm">
      <span
        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
          suggestion.action === "add"
            ? "bg-sky-100 text-sky-800"
            : "bg-emerald-100 text-emerald-800"
        }`}
      >
        {suggestion.action === "add" ? "pick up" : "send home"}
      </span>
      <span className="grow text-neutral-700">
        {suggestion.reason}
        {arrival && <span className="text-neutral-500"> Arriving {fmtDate(arrival)}.</span>}
      </span>
      {planned ? (
        <span className="text-xs font-medium text-emerald-700">✓ in your swaps</span>
      ) : override ? (
        <span className="text-xs font-medium text-neutral-500">
          ↷ planned at {waypointName(override.waypointId)} instead
        </span>
      ) : (
        <button
          type="button"
          className="rounded-md border border-amber-400 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
          onClick={accept}
        >
          Accept
        </button>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function GearView() {
  const gear = usePlanStore((s) => s.plan.gear);
  const swaps = usePlanStore((s) => s.plan.swaps);
  const addGearItem = usePlanStore((s) => s.addGearItem);
  const addSwap = usePlanStore((s) => s.addSwap);
  const projection = useProjection();
  const climateReady = useClimateStore((s) => s.status === "ready");

  return (
    <div className="space-y-6 pb-8">
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Gear</h2>
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            onClick={() => addGearItem({ name: "New item", category: "other" })}
          >
            + Add item
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Give an item a comfort threshold (the low °F at which you want it) and
          Ridgeline will suggest where to swap it. No threshold = fully manual.
        </p>
        {gear.length > 0 && (
          <ul className="mt-3 space-y-2">
            {gear.map((g) => (
              <GearItemRow key={g.id} item={g} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Suggested swaps</h2>
        <p className="mt-1 text-sm text-neutral-500">
          From your thresholds and the projected corrected lows. Advisory — accept,
          ignore, or place your own swap instead.
        </p>
        {!climateReady ? (
          <div className="mt-3">
            <LoadClimateCard />
          </div>
        ) : projection.suggestedSwaps.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            No suggestions — add a comfort threshold to a gear item.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {projection.suggestedSwaps.map((s, i) => (
              <SuggestionRow
                key={`${s.itemId}-${s.action}-${s.triggerWaypointId}-${i}`}
                suggestion={s}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Your swaps</h2>
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            onClick={() =>
              addSwap({
                waypointId: RESUPPLY_WAYPOINTS[0].id,
                addItemIds: [],
                removeItemIds: [],
              })
            }
          >
            + Add swap
          </button>
        </div>
        {swaps.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            No swaps yet. Accept a suggestion or add one at a resupply town —
            e.g. {waypointName(RESUPPLY_WAYPOINTS[0].id)}.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {swaps.map((sw) => (
              <SwapCard key={sw.id} swapId={sw.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
