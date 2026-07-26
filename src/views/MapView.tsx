import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LoadClimateCard } from "../components/LoadClimateCard";
import { fmtDate, fmtTemp, tempColor } from "../components/format";
import { useProjection, WAYPOINTS } from "../state/useProjection";

const POSITIONS = WAYPOINTS.map((w) => [w.lat, w.lng] as [number, number]);

/**
 * Map view: every waypoint as a marker colored by its corrected low on the
 * projected arrival date — the seasonal arc drawn in space instead of down a
 * page. The dashed connector is waypoint-to-waypoint, NOT the trail
 * centerline (CLAUDE.md: we deliberately don't ship the full GPS track).
 *
 * Default export for React.lazy — Leaflet stays out of the main bundle.
 */
export default function MapView() {
  const projection = useProjection();

  return (
    <div className="space-y-4">
      <LoadClimateCard />

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <MapContainer
          bounds={POSITIONS}
          boundsOptions={{ padding: [20, 20] }}
          scrollWheelZoom
          className="h-[70vh] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline
            positions={POSITIONS}
            pathOptions={{ color: "#525252", weight: 2, dashArray: "4 6", opacity: 0.7 }}
          />
          {WAYPOINTS.map((w, i) => {
            const pw = projection.waypoints[i];
            const weather = pw.weather;
            return (
              <CircleMarker
                key={w.id}
                center={[w.lat, w.lng]}
                radius={7}
                pathOptions={{
                  color: "#ffffff",
                  weight: 1.5,
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
                          {fmtTemp(weather.correctedMinF)}/{fmtTemp(weather.correctedMaxF)}
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
      </div>

      <p className="px-1 text-xs text-neutral-500">
        Markers are colored by the elevation-corrected normal low on your projected
        arrival date (blue = cold, red = warm). The dashed line connects waypoints
        for orientation — it is not the trail centerline.
      </p>
    </div>
  );
}
