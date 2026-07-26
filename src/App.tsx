import waypoints from "./data/waypoints.json";

/**
 * Phase 1 placeholder shell. Proves the toolchain end to end (React, Tailwind,
 * JSON data import). Real views land in Phase 5.
 */
export default function App() {
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold tracking-tight">Ridgeline</h1>
      <p className="mt-2 text-neutral-600">
        Typical-weather planning for an AT thru-hike. Scaffold build — the real
        UI arrives in Phase 5.
      </p>
      <p className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm text-neutral-700">
        {waypoints.length} waypoints loaded: {first.name} (mile {first.trailMile})
        → {last.name} (mile {last.trailMile}).
      </p>
    </main>
  );
}
