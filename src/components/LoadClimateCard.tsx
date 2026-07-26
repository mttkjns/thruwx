import { CLIMATE_SIZE_NOTE, useClimateStore } from "../state/climateStore";

/**
 * The explicit gate for the climate download. The rest of the UI (schedule,
 * sun/moon, gear) works without it; temperatures and suggestions need it.
 * Renders nothing once the data is in.
 */
export function LoadClimateCard() {
  const status = useClimateStore((s) => s.status);
  const error = useClimateStore((s) => s.error);
  const load = useClimateStore((s) => s.load);

  if (status === "ready") return null;

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="grow">
          <span className="font-semibold">Climate data isn't loaded yet.</span>{" "}
          Temperatures, freeze odds, and swap suggestions need the normals dataset —
          a one-time download of {CLIMATE_SIZE_NOTE}, cached by your browser.
        </p>
        <button
          type="button"
          disabled={status === "loading"}
          className="rounded-md border border-sky-400 bg-white px-3 py-2 font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-60"
          onClick={() => void load()}
        >
          {status === "loading" ? "Loading…" : "Load climate data"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-red-700">Download failed ({error}) — try again.</p>
      )}
    </section>
  );
}
