import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { HikeChart } from "../components/HikeChart";
import { LoadClimateCard } from "../components/LoadClimateCard";
import { PlanSummary } from "../components/PlanSummary";
import { fmtDate, tempColor, useTempFormat } from "../components/format";
import { useProjection, WAYPOINTS } from "../state/useProjection";

const POSITIONS = WAYPOINTS.map((w) => [w.lat, w.lng] as [number, number]);

/** Touch-first device (phone/tablet), where a tall map swallows page scrolling. */
const IS_TOUCH =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Turns one-finger drag and pinch-zoom on/off. Disabling them also drops
 * Leaflet's touch-action CSS on the container, so swipes scroll the page.
 */
function PanLock({ locked }: { locked: boolean }) {
  const map = useMap();
  useEffect(() => {
    for (const handler of [map.dragging, map.touchZoom]) {
      if (locked) handler.disable();
      else handler.enable();
    }
  }, [map, locked]);
  return null;
}

/**
 * Map view: every waypoint in the planned section as a marker colored by its
 * corrected low on the projected arrival date (waypoints outside the section
 * stay as small muted markers) — the seasonal arc drawn in space instead of down a
 * page. The dashed connector is waypoint-to-waypoint, NOT the trail
 * centerline (CLAUDE.md: we deliberately don't ship the full GPS track).
 *
 * Default export for React.lazy — Leaflet stays out of the main bundle.
 */
export default function MapView() {
  const projection = useProjection();
  // Projection order is hike order (reversed for SOBO); markers are placed
  // geographically, so look up by id instead of pairing indexes.
  const projById = new Map(projection.waypoints.map((p) => [p.waypointId, p]));
  // Set by the chart below (crosshair or data-table row); the matching map
  // marker enlarges with an ink ring so table ↔ geography stay connected.
  const [hoverId, setHoverId] = useState<string | null>(null);
  // On touch devices the map starts locked so swipes scroll the page; the
  // button over the map unlocks panning and zooming.
  const [locked, setLocked] = useState(IS_TOUCH);
  const { temp } = useTempFormat();

  return (
    <div className="space-y-4">
      <PlanSummary />
      <LoadClimateCard />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div>
          <div className="relative overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <MapContainer
          bounds={POSITIONS}
          boundsOptions={{ padding: [20, 20] }}
          scrollWheelZoom
          className="h-[70vh] w-full"
        >
          <PanLock locked={locked} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline
            positions={POSITIONS}
            pathOptions={{ color: "#525252", weight: 2, dashArray: "4 6", opacity: 0.7 }}
          />
          {WAYPOINTS.map((w) => {
            const pw = projById.get(w.id);
            // Outside the planned section: a small muted marker, no projection.
            if (!pw) {
              return (
                <CircleMarker
                  key={w.id}
                  center={[w.lat, w.lng]}
                  radius={4}
                  pathOptions={{ color: "#ffffff", weight: 1, fillColor: "#d4d4d4", fillOpacity: 1 }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">
                        {w.name} <span className="font-normal text-neutral-500">{w.state}</span>
                      </p>
                      <p className="mt-0.5 text-neutral-500">mi {w.trailMile.toFixed(0)} · outside your section</p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            }
            const weather = pw.weather;
            const hovered = hoverId === w.id;
            return (
              <CircleMarker
                key={w.id}
                center={[w.lat, w.lng]}
                radius={hovered ? 11 : 7}
                pathOptions={{
                  color: hovered ? "#0b0b0b" : "#ffffff",
                  weight: hovered ? 2.5 : 1.5,
                  fillColor: weather ? tempColor(weather.correctedMinF) : "#a3a3a3",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">
                      {w.name} <span className="font-normal text-neutral-500">{w.state}</span>
                    </p>
                    <p className="mt-0.5 text-neutral-600">
                      mi {w.trailMile.toFixed(0)} · arrive {fmtDate(pw.arrivalDate)} (day{" "}
                      {pw.dayOfHike})
                    </p>
                    {weather ? (
                      <p className="mt-0.5">
                        <span className="font-medium">
                          {temp(weather.correctedMinF)}/{temp(weather.correctedMaxF)}
                        </span>{" "}
                        · ❄ {Math.round(weather.freezeProbability * 100)}% · ☂{" "}
                        {Math.round(weather.precipProbability * 100)}%
                      </p>
                    ) : (
                      <p className="mt-0.5 text-neutral-400">awaiting climate data</p>
                    )}
                    {w.isResupply && (
                      <p className="mt-0.5 text-emerald-700">resupply town</p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          </MapContainer>
          {IS_TOUCH && (
            <button
              type="button"
              className="absolute right-2 top-2 z-[1000] rounded-md border border-neutral-300 bg-white/95 px-3 py-1.5 text-sm shadow-sm"
              aria-pressed={!locked}
              onClick={() => setLocked(!locked)}
            >
              {locked ? "🔒 Tap to move map" : "🔓 Lock map"}
            </button>
          )}
          </div>

          <p className="mt-2 px-1 text-xs text-neutral-500">
            Markers are colored by the elevation-corrected normal low on your projected
            arrival date (blue = cold, red = warm). The dashed line connects waypoints
            for orientation — it is not the trail centerline.
          </p>
        </div>

        <HikeChart onHoverWaypoint={setHoverId} />
      </div>
    </div>
  );
}
