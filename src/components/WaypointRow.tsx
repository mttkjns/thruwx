import type { Leg } from "../domain/profile";
import type { Waypoint, WaypointProjection } from "../domain/types";
import { useClimateStore } from "../state/climateStore";
import {
  fmtDate,
  fmtDayLength,
  fmtTemp,
  fmtTimeET,
  MOON_EMOJI,
  moonLabel,
} from "./format";
import { LegProfile } from "./LegProfile";
import { TempBand } from "./TempBand";

/**
 * One waypoint on the timeline: arrival, corrected temps (with the station →
 * trail correction inspectable), precip, sun, moon, and the elevation profile
 * of the leg walked to get here.
 */
export function WaypointRow({
  waypoint,
  projection,
  leg,
  legFromName,
}: {
  waypoint: Waypoint;
  projection: WaypointProjection;
  /** Absent for the first waypoint of the section. */
  leg?: Leg;
  legFromName?: string | null;
}) {
  const w = projection.weather;
  const climateReady = useClimateStore((s) => s.status === "ready");
  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-neutral-900">
            {waypoint.name}
            <span className="ml-1.5 text-sm font-normal text-neutral-500">
              {waypoint.state} · mi {waypoint.trailMile.toFixed(0)}
            </span>
          </h3>
        </div>
        <p className="text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">
            {fmtDate(projection.arrivalDate)}
          </span>{" "}
          · day {projection.dayOfHike}
        </p>
      </div>

      {leg && <LegProfile leg={leg} fromName={legFromName ?? null} />}

      {w ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm tabular-nums">
                <span className="font-semibold text-neutral-900">{fmtTemp(w.correctedMinF)}</span>
                <span className="text-neutral-400"> / </span>
                <span className="font-semibold text-neutral-900">{fmtTemp(w.correctedMaxF)}</span>
              </span>
              <div className="grow">
                <TempBand lowF={w.correctedMinF} highF={w.correctedMaxF} />
              </div>
            </div>
            <details className="mt-1.5 text-xs text-neutral-500">
              <summary className="cursor-pointer select-none hover:text-neutral-700">
                corrected from station {fmtTemp(w.stationMinF)}/{fmtTemp(w.stationMaxF)}
                {" · "}trail {w.elevationDeltaFt >= 0 ? "+" : ""}
                {w.elevationDeltaFt.toLocaleString()} ft
              </summary>
              <p className="mt-1 max-w-prose">
                Trail at {waypoint.trailElevationFt.toLocaleString()} ft vs station at{" "}
                {waypoint.stationElevationFt?.toLocaleString()} ft. Temperatures adjusted
                by 3.5°F per 1,000 ft of elevation difference — ridge weather, not town
                weather.
              </p>
            </details>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 sm:justify-end">
            {w.freezeProbability >= 0.05 && (
              <span
                className={
                  w.freezeProbability >= 0.3 ? "font-medium text-sky-700" : undefined
                }
              >
                ❄ {Math.round(w.freezeProbability * 100)}% freeze
              </span>
            )}
            <span>☂ {Math.round(w.precipProbability * 100)}% wet</span>
            <span>
              ☀ {fmtTimeET(projection.sun.sunrise)}–{fmtTimeET(projection.sun.sunset)} (
              {fmtDayLength(projection.sun.dayLengthHours)})
            </span>
            <span title={`${Math.round(projection.moon.illumination * 100)}% illuminated`}>
              {MOON_EMOJI[projection.moon.phaseName]} {moonLabel(projection.moon.phaseName)}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-400">
          {climateReady
            ? "No climate station assigned — weather unavailable here."
            : "Awaiting climate data."}
        </p>
      )}
    </li>
  );
}
