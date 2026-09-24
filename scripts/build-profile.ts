/**
 * Elevation-profile pipeline — generates src/data/profile.json.
 *
 * Trail line from OpenStreetMap (AT superroute, relation 156553), elevations
 * from USGS 3DEP. Only a trailMile → elevation table is shipped, never the
 * geometry. See docs/PHASE0_DATA_NOTES.md "Decision 3" for the findings this
 * implements:
 *
 *   - Each child relation is chained by nearest endpoint, THEN oriented against
 *     the previous chain (children don't share one direction).
 *   - Line length ≠ official miles, so miles come from calibration: waypoints
 *     within ANCHOR_MAX_MI of the line are pinned to their trailMile and line
 *     distance is scaled linearly between anchors.
 *   - 3DEP getSamples takes contiguous batches (scattered points time out),
 *     returns meters, unordered by locationId.
 *   - On bridges (OSM `bridge=*`) the DEM reads the water or valley below,
 *     so bridge samples are interpolated from the ground at either end.
 *   - Every waypoint's own trailElevationFt is inserted as an exact sample so
 *     summits aren't clipped by the grid and the profile agrees with the app.
 *
 * Output is a derivative of OSM data and is licensed ODbL
 * (© OpenStreetMap contributors).
 *
 * Run: npm run build:profile   (network: Overpass + 3DEP; ~10 min uncached)
 * Caches raw responses under scripts/.cache/ (gitignored) so reruns are fast.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ElevationProfile, Waypoint } from "../src/domain/types";

const RELATION_ID = 156553;
const STEP_MI = 0.5;
const ANCHOR_MAX_MI = 0.25;
const BATCH = 100;
const USER_AGENT = "thruwx-build/0.1 (mail@thruwx.com)";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const SAMPLES_URL =
  "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples";
const FT_PER_M = 3.28084;

const DATA_DIR = path.join(import.meta.dirname, "../src/data");
const OUT_PATH = path.join(DATA_DIR, "profile.json");
const CACHE_DIR = path.join(import.meta.dirname, ".cache");
const OSM_CACHE = path.join(CACHE_DIR, "osm-at.json");
const ELEV_CACHE = path.join(CACHE_DIR, "elev-3dep.json");

type LatLon = [lat: number, lon: number];

interface OsmMember { type: "node" | "way" | "relation"; ref: number; role: string }
interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  members?: OsmMember[];
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** Polyline plus a parallel flag: is this vertex part of a bridge way? */
interface TrailLine { points: LatLon[]; bridge: boolean[] }

const round = (n: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Great-circle distance in miles. */
function haversineMi(a: LatLon, b: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/* ---- 1. OSM line ---------------------------------------------------- */

async function fetchOsm(): Promise<OsmElement[]> {
  if (existsSync(OSM_CACHE)) {
    console.log(`Using cached OSM data (${OSM_CACHE})`);
    return JSON.parse(readFileSync(OSM_CACHE, "utf8")).elements;
  }
  // The superroute nests route relations up to a few levels deep.
  const query =
    `[out:json][timeout:240];rel(${RELATION_ID})->.a;rel(r.a)->.b;rel(r.b)->.c;` +
    `(.a;.b;.c;);out;(way(r.a);way(r.b);way(r.c););out geom;`;
  for (const url of OVERPASS_URLS) {
    console.log(`Fetching OSM relation ${RELATION_ID} from ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT },
      body: new URLSearchParams({ data: query }),
    });
    const text = await res.text();
    if (res.ok && text.startsWith("{")) {
      writeFileSync(OSM_CACHE, text);
      return JSON.parse(text).elements;
    }
    console.warn(`  HTTP ${res.status}; trying next endpoint`);
  }
  throw new Error("All Overpass endpoints failed");
}

const isBridge = (w: OsmElement) => w.tags?.bridge !== undefined && w.tags.bridge !== "no";

/** Chain one route relation's main-line ways by nearest endpoint. */
function chainRelation(rel: OsmElement, ways: Map<number, OsmElement>): TrailLine {
  const segs = rel.members!
    .filter((m) => m.type === "way" && ["", "forward", "backward"].includes(m.role))
    .map((m) => ways.get(m.ref))
    .filter((w): w is OsmElement => w?.geometry !== undefined && w.geometry.length > 0)
    .map((w) => ({ pts: w.geometry!.map((p): LatLon => [p.lat, p.lon]), bridge: isBridge(w) }));
  if (segs.length === 0) throw new Error(`relation ${rel.id} has no ways`);

  const points = [...segs[0].pts];
  const bridge = points.map(() => segs[0].bridge);
  if (segs[1]) {
    const next = segs[1].pts;
    const near = (p: LatLon) => Math.min(haversineMi(p, next[0]), haversineMi(p, next.at(-1)!));
    if (near(points[0]) < near(points.at(-1)!)) points.reverse();
  }
  for (const seg of segs.slice(1)) {
    const end = points.at(-1)!;
    const flip = haversineMi(end, seg.pts.at(-1)!) < haversineMi(end, seg.pts[0]);
    points.push(...(flip ? [...seg.pts].reverse() : seg.pts));
    bridge.push(...seg.pts.map(() => seg.bridge));
  }
  return { points, bridge };
}

const reverseLine = (l: TrailLine) => { l.points.reverse(); l.bridge.reverse(); };

/** Springer → Katahdin as one polyline; throws on any gap over MAX_GAP_MI. */
function stitch(elements: OsmElement[]): TrailLine {
  const MAX_GAP_MI = 0.25;
  const rels = new Map(elements.filter((e) => e.type === "relation").map((e) => [e.id, e]));
  const ways = new Map(elements.filter((e) => e.type === "way").map((e) => [e.id, e]));

  // Leaf route relations (those holding ways) in superroute order, depth-first.
  const leaves: OsmElement[] = [];
  const walk = (id: number) => {
    const rel = rels.get(id);
    if (!rel) throw new Error(`relation ${id} missing from OSM response`);
    const kids = rel.members!.filter((m) => m.type === "relation");
    if (kids.length === 0) leaves.push(rel);
    else kids.forEach((k) => walk(k.ref));
  };
  walk(RELATION_ID);

  const springer: LatLon = [34.6273, -84.1936];
  const line: TrailLine = { points: [], bridge: [] };
  for (const rel of leaves) {
    const chain = chainRelation(rel, ways);
    const ref = line.points.at(-1) ?? springer;
    if (haversineMi(ref, chain.points.at(-1)!) < haversineMi(ref, chain.points[0])) reverseLine(chain);
    const gap = haversineMi(ref, chain.points[0]);
    if (line.points.length > 0 && gap > MAX_GAP_MI) {
      throw new Error(`gap of ${gap.toFixed(2)} mi before relation ${rel.id}`);
    }
    line.points.push(...chain.points);
    line.bridge.push(...chain.bridge);
  }
  return line;
}

/* ---- 2. Calibrate line distance → trail mile ------------------------ */

interface Anchor { lineMi: number; trailMile: number; id: string }

function calibrate(line: LatLon[], cum: number[], waypoints: Waypoint[]): Anchor[] {
  const anchors: Anchor[] = [];
  for (const w of waypoints) {
    let best = Infinity;
    let bestI = 0;
    for (let i = 0; i < line.length; i++) {
      const d = haversineMi([w.lat, w.lng], line[i]);
      if (d < best) { best = d; bestI = i; }
    }
    if (best > ANCHOR_MAX_MI) continue;
    const prev = anchors.at(-1);
    if (prev && cum[bestI] <= prev.lineMi) {
      console.warn(`  skip anchor ${w.id}: not after ${prev.id} along the line`);
      continue;
    }
    anchors.push({ lineMi: cum[bestI], trailMile: w.trailMile, id: w.id });
  }
  const maxMile = waypoints.at(-1)!.trailMile;
  if (anchors[0]?.trailMile !== 0 || anchors.at(-1)?.trailMile !== maxMile) {
    throw new Error("both termini must be anchors — check Springer/Katahdin coordinates");
  }
  console.log(`Anchors: ${anchors.length}/${waypoints.length} waypoints within ${ANCHOR_MAX_MI} mi`);
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    const ratio = (b.lineMi - a.lineMi) / (b.trailMile - a.trailMile);
    if (ratio < 0.8 || ratio > 1.15) {
      console.warn(`  WARN ${a.id} → ${b.id}: line/official ratio ${ratio.toFixed(2)}`);
    }
  }
  return anchors;
}

/** Point on the line at a given trail mile (inverse of the anchor scaling). */
function pointAtMile(
  mile: number,
  anchors: Anchor[],
  { points: line, bridge }: TrailLine,
  cum: number[],
): { point: LatLon; onBridge: boolean } {
  let k = anchors.findIndex((a) => a.trailMile >= mile);
  if (k <= 0) k = 1;
  const a = anchors[k - 1];
  const b = anchors[k];
  const lineMi = a.lineMi + ((mile - a.trailMile) / (b.trailMile - a.trailMile)) * (b.lineMi - a.lineMi);

  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= lineMi) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  const t = span > 0 ? (lineMi - cum[lo]) / span : 0;
  return {
    point: [
      line[lo][0] + t * (line[hi][0] - line[lo][0]),
      line[lo][1] + t * (line[hi][1] - line[lo][1]),
    ],
    // Both ends on bridge vertices = this span is the bridge deck.
    onBridge: bridge[lo] && bridge[hi],
  };
}

/* ---- 3. Elevations from 3DEP ---------------------------------------- */

const pointKey = ([lat, lon]: LatLon) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

async function fetchBatch(points: LatLon[]): Promise<number[]> {
  const body = new URLSearchParams({
    geometry: JSON.stringify({
      points: points.map(([lat, lon]) => [lon, lat]),
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryMultipoint",
    returnFirstValueOnly: "true",
    interpolation: "RSP_BilinearInterpolation",
    f: "json",
  });
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(SAMPLES_URL, { method: "POST", body, headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { samples?: { locationId: number; value: string }[]; error?: unknown };
      if (!json.samples) throw new Error(`no samples: ${JSON.stringify(json.error)}`);
      const out = new Array<number>(points.length).fill(NaN);
      for (const s of json.samples) out[s.locationId] = Number(s.value) * FT_PER_M;
      const bad = out.findIndex((v) => !Number.isFinite(v) || v < -100);
      if (bad >= 0) throw new Error(`no elevation at ${points[bad].join(",")}`);
      return out;
    } catch (err) {
      if (attempt >= 4) throw err;
      console.warn(`  batch failed (${(err as Error).message}); retry ${attempt}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
}

async function elevations(points: LatLon[]): Promise<number[]> {
  const cache: Record<string, number> = existsSync(ELEV_CACHE)
    ? JSON.parse(readFileSync(ELEV_CACHE, "utf8"))
    : {};
  const todo = points.filter((p) => cache[pointKey(p)] === undefined);
  console.log(`Elevations: ${points.length - todo.length} cached, ${todo.length} to fetch`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const values = await fetchBatch(batch);
    batch.forEach((p, j) => (cache[pointKey(p)] = round(values[j], 1)));
    writeFileSync(ELEV_CACHE, JSON.stringify(cache)); // resumable
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  return points.map((p) => cache[pointKey(p)]);
}

/* ---- main ------------------------------------------------------------ */

mkdirSync(CACHE_DIR, { recursive: true });
const waypoints: Waypoint[] = JSON.parse(readFileSync(path.join(DATA_DIR, "waypoints.json"), "utf8"));

const trail = stitch(await fetchOsm());
const line = trail.points;
const cum = [0];
for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversineMi(line[i - 1], line[i]));
console.log(`Stitched line: ${line.length} points, ${cum.at(-1)!.toFixed(1)} mi (no gaps)`);

const anchors = calibrate(line, cum, waypoints);
const maxMile = waypoints.at(-1)!.trailMile;
const gridMiles: number[] = [];
for (let m = 0; m < maxMile; m = round(m + STEP_MI, 3)) gridMiles.push(m);

const gridPts = gridMiles.map((m) => pointAtMile(m, anchors, trail, cum));
const gridElev = await elevations(gridPts.map((g) => g.point));

// Bridge samples read the water below: interpolate from the nearest ground
// samples on either side.
let bridged = 0;
for (let i = 0; i < gridPts.length; i++) {
  if (!gridPts[i].onBridge) continue;
  let a = i;
  while (a > 0 && gridPts[a].onBridge) a--;
  let b = i;
  while (b < gridPts.length - 1 && gridPts[b].onBridge) b++;
  const t = (gridMiles[i] - gridMiles[a]) / (gridMiles[b] - gridMiles[a]);
  const was = gridElev[i];
  gridElev[i] = gridElev[a] + t * (gridElev[b] - gridElev[a]);
  bridged++;
  if (Math.abs(was - gridElev[i]) > 50) {
    console.log(`  bridge at mile ${gridMiles[i]}: ${Math.round(was)} → ${Math.round(gridElev[i])} ft`);
  }
}
console.log(`Bridges: ${bridged} samples interpolated`);

// Merge grid + exact waypoint elevations; a waypoint replaces any grid
// sample within half a step of it so miles stay strictly increasing.
const wpMiles = waypoints.map((w) => w.trailMile);
const samples: [number, number][] = gridMiles
  .map((m, i): [number, number] => [m, Math.round(gridElev[i])])
  .filter(([m]) => wpMiles.every((wm) => Math.abs(wm - m) >= STEP_MI / 2));
for (const w of waypoints) samples.push([w.trailMile, w.trailElevationFt]);
samples.sort((a, b) => a[0] - b[0]);

const profile: ElevationProfile = {
  source:
    "Trail line: OpenStreetMap relation 156553 (© OpenStreetMap contributors, ODbL). " +
    "Elevations: USGS 3DEP (public domain). Miles calibrated to waypoints.json.",
  license: "ODbL-1.0",
  generated: new Date().toISOString().slice(0, 10),
  stepMi: STEP_MI,
  samples,
};
writeFileSync(OUT_PATH, JSON.stringify(profile) + "\n");
const peak = samples.reduce((a, b) => (b[1] > a[1] ? b : a));
console.log(
  `\nWrote ${OUT_PATH}: ${samples.length} samples, ` +
  `${(JSON.stringify(profile).length / 1024).toFixed(0)} KB, peak ${peak[1]} ft at mile ${peak[0]}`,
);
