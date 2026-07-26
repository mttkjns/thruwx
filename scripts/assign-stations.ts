/**
 * Station assignment (Phase 2 curation tool).
 *
 * For each waypoint in src/data/waypoints.json, finds the nearest ACIS station
 * whose maxt/mint/pcpn records fully span the normals window (1991–2020) and
 * writes stationId + stationElevationFt back into waypoints.json.
 *
 * Suitability (see docs/PHASE0_DATA_NOTES.md): valid_daterange must start on or
 * before 1991-01-01 and end on or after 2020-12-31 for ALL THREE elements —
 * dead-in-1960 stations near trail towns are common. That alone is NOT enough:
 * some stations span the window on paper but are mostly holes inside it (Pedlar
 * Dam VA: 92% missing temps; Carlisle PA: 56% missing everything). So each
 * candidate's actual daily data is fetched and rejected unless every element is
 * ≤10% missing within the window; we then fall back to the next-nearest.
 *
 * Rerunnable: only touches stationId/stationElevationFt, preserves curation.
 *
 *   npx tsx scripts/assign-stations.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface WaypointRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stationId: string | null;
  stationElevationFt: number | null;
  [k: string]: unknown;
}

interface StnMetaEntry {
  name: string;
  state: string;
  sids: string[];
  ll: [number, number];
  elev?: number;
  valid_daterange: [string, string][] | [][];
}

const WINDOW_START = "1991-01-01";
const WINDOW_END = "2020-12-31";
const EXPECTED_ROWS = 10958; // days in the window
const MAX_MISSING_FRACTION = 0.1;
const ACIS_URL = "https://data.rcc-acis.org/StnMeta";
const STNDATA_URL = "https://data.rcc-acis.org/StnData";
const WAYPOINTS_PATH = path.join(import.meta.dirname, "../src/data/waypoints.json");

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function coversWindow(ranges: StnMetaEntry["valid_daterange"]): boolean {
  if (!Array.isArray(ranges) || ranges.length < 3) return false;
  return ranges.every(
    (r) => r.length === 2 && r[0] <= WINDOW_START && r[1] >= WINDOW_END,
  );
}

/** Prefer the GHCN id (sid type 6, e.g. "USC00273850 6") for stability/readability. */
function pickSid(sids: string[]): string {
  const ghcn = sids.find((s) => s.endsWith(" 6"));
  return (ghcn ?? sids[0]).split(" ")[0];
}

/** sid → per-element missing fractions within the window (memoized across waypoints). */
const completenessCache = new Map<string, { ok: boolean; detail: string }>();

async function checkCompleteness(sid: string): Promise<{ ok: boolean; detail: string }> {
  const cached = completenessCache.get(sid);
  if (cached) return cached;

  const res = await fetch(STNDATA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sid,
      sdate: WINDOW_START,
      edate: WINDOW_END,
      elems: [{ name: "maxt" }, { name: "mint" }, { name: "pcpn" }],
    }),
  });
  if (!res.ok) throw new Error(`StnData HTTP ${res.status} for ${sid}`);
  const json = (await res.json()) as { error?: string; data?: [string, string, string, string][] };

  let result: { ok: boolean; detail: string };
  if (json.error || !json.data) {
    result = { ok: false, detail: `StnData error: ${json.error ?? "no data"}` };
  } else {
    const miss = [0, 0, 0];
    for (const row of json.data) {
      for (let e = 0; e < 3; e++) if (row[e + 1] === "M") miss[e]++;
    }
    // Rows ACIS never returned count as missing too.
    const absent = EXPECTED_ROWS - json.data.length;
    const fracs = miss.map((m) => (m + absent) / EXPECTED_ROWS);
    const detail = `maxt ${(100 * fracs[0]).toFixed(1)}% / mint ${(100 * fracs[1]).toFixed(1)}% / pcpn ${(100 * fracs[2]).toFixed(1)}% missing`;
    result = { ok: fracs.every((f) => f <= MAX_MISSING_FRACTION), detail };
  }
  completenessCache.set(sid, result);
  return result;
}

async function findStation(wp: WaypointRow) {
  for (const halfDeg of [0.5, 1.0, 1.5]) {
    const bbox = [wp.lng - halfDeg, wp.lat - halfDeg, wp.lng + halfDeg, wp.lat + halfDeg].join(",");
    const res = await fetch(ACIS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bbox,
        elems: "maxt,mint,pcpn",
        meta: "name,state,sids,ll,elev,valid_daterange",
      }),
    });
    if (!res.ok) throw new Error(`StnMeta HTTP ${res.status} for ${wp.id}`);
    const { meta } = (await res.json()) as { meta: StnMetaEntry[] };

    const candidates = meta
      .filter((s) => coversWindow(s.valid_daterange) && typeof s.elev === "number")
      .map((s) => ({
        sid: pickSid(s.sids),
        name: s.name,
        state: s.state,
        elevFt: s.elev as number,
        distMi: haversineMiles(wp.lat, wp.lng, s.ll[1], s.ll[0]),
      }))
      .sort((a, b) => a.distMi - b.distMi);

    for (const c of candidates) {
      const firstLook = !completenessCache.has(c.sid);
      const { ok, detail } = await checkCompleteness(c.sid);
      if (ok) return c;
      if (firstLook) {
        console.log(`  reject ${c.sid} (${c.name}, ${c.distMi.toFixed(1)} mi): ${detail}`);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return null;
}

const dryRun = process.argv.includes("--dry-run");
const waypoints: WaypointRow[] = JSON.parse(readFileSync(WAYPOINTS_PATH, "utf8"));

console.log("waypoint                        station        name                      dist(mi)  stnElev(ft)");
let failures = 0;
for (const wp of waypoints) {
  const best = await findStation(wp);
  if (!best) {
    failures++;
    console.log(`${wp.id.padEnd(30)}  ** NO STATION covering 1991-2020 within 1.5 deg **`);
    continue;
  }
  wp.stationId = best.sid;
  wp.stationElevationFt = Math.round(best.elevFt);
  console.log(
    wp.id.padEnd(30),
    best.sid.padEnd(14),
    `${best.name}, ${best.state}`.padEnd(25).slice(0, 25),
    best.distMi.toFixed(1).padStart(8),
    String(Math.round(best.elevFt)).padStart(11),
  );
  await new Promise((r) => setTimeout(r, 150)); // be polite to ACIS
}

if (dryRun) {
  console.log(`\n--dry-run: not writing. ${failures} failures.`);
} else {
  writeFileSync(WAYPOINTS_PATH, JSON.stringify(waypoints, null, 2) + "\n");
  console.log(`\nWrote ${WAYPOINTS_PATH}. ${failures} waypoints without a station.`);
}
if (failures > 0) process.exit(1);
