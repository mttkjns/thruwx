/**
 * Climate pipeline — generates src/data/climate.json from RCC-ACIS.
 *
 * For each unique stationId in src/data/waypoints.json, pulls daily
 * maxt/mint/pcpn for the normals window (1991–2020) from StnData and computes
 * per-day-of-year normals. See docs/PHASE0_DATA_NOTES.md for the decisions
 * this implements:
 *
 *   - "M" (missing) excluded from stats; never coerced to 0.
 *   - "T" (trace)   0.00 in toward mean precip; NOT a measurable-precip day.
 *   - Day-of-year uses the leap layout of DayOfYearIndex (0-based, Feb 29 = 59).
 *   - Feb 29 has only ~8 samples, so its normals are pooled with Feb 28 + Mar 1.
 *   - Warn when an element is missing >10% of the window (biases probabilities).
 *
 * Run: npm run build:climate   (rarely needed; normals update ~once a decade)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ClimateData, DailyNormal } from "../src/domain/types";

const WINDOW_START = "1991-01-01";
const WINDOW_END = "2020-12-31";
const EXPECTED_ROWS = 10958; // days in 1991-01-01..2020-12-31
const MISSING_WARN_FRACTION = 0.1;
const STNDATA_URL = "https://data.rcc-acis.org/StnData";

const DATA_DIR = path.join(import.meta.dirname, "../src/data");
const OUT_PATH = path.join(DATA_DIR, "climate.json");

/** Cumulative days before each month in a leap year. */
const CUM_DAYS_LEAP = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const FEB29_INDEX = 59;

/** "YYYY-MM-DD" → 0-based leap-layout index (Feb 29 = 59, Mar 1 = 60 always). */
function leapIndex(dateStr: string): number {
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  return CUM_DAYS_LEAP[month - 1] + day - 1;
}

interface Acc {
  maxSum: number; maxN: number;
  minSum: number; minN: number; freezeN: number;
  pcpnSum: number; pcpnN: number; wetN: number;
}
const newAcc = (): Acc => ({
  maxSum: 0, maxN: 0, minSum: 0, minN: 0, freezeN: 0, pcpnSum: 0, pcpnN: 0, wetN: 0,
});
function addAcc(into: Acc, from: Acc): void {
  into.maxSum += from.maxSum; into.maxN += from.maxN;
  into.minSum += from.minSum; into.minN += from.minN; into.freezeN += from.freezeN;
  into.pcpnSum += from.pcpnSum; into.pcpnN += from.pcpnN; into.wetN += from.wetN;
}

function parseTemp(v: string): number | null {
  if (v === "M") return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

/** Returns inches; trace = 0.00 in (and is not counted as measurable by caller). */
function parsePrecip(v: string): { inches: number; trace: boolean } | null {
  if (v === "M") return null;
  if (v === "T") return { inches: 0, trace: true };
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : { inches: n, trace: false };
}

const round = (n: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

async function fetchStation(sid: string): Promise<[string, string, string, string][]> {
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
  const json = (await res.json()) as {
    error?: string;
    data?: [string, string, string, string][];
  };
  if (json.error || !json.data) throw new Error(`StnData error for ${sid}: ${json.error ?? "no data"}`);
  return json.data;
}

function computeNormals(sid: string, rows: [string, string, string, string][]): DailyNormal[] {
  if (rows.length !== EXPECTED_ROWS) {
    console.warn(`  WARN ${sid}: ${rows.length} rows (expected ${EXPECTED_ROWS})`);
  }

  const accs: Acc[] = Array.from({ length: 366 }, newAcc);
  let missMax = 0, missMin = 0, missPcpn = 0;

  for (const [dateStr, maxV, minV, pcpnV] of rows) {
    const acc = accs[leapIndex(dateStr)];

    const maxF = parseTemp(maxV);
    if (maxF === null) missMax++;
    else { acc.maxSum += maxF; acc.maxN++; }

    const minF = parseTemp(minV);
    if (minF === null) missMin++;
    else {
      acc.minSum += minF; acc.minN++;
      if (minF <= 32) acc.freezeN++;
    }

    const p = parsePrecip(pcpnV);
    if (p === null) missPcpn++;
    else {
      acc.pcpnSum += p.inches; acc.pcpnN++;
      if (!p.trace && p.inches >= 0.01) acc.wetN++;
    }
  }

  for (const [label, miss] of [["maxt", missMax], ["mint", missMin], ["pcpn", missPcpn]] as const) {
    const frac = miss / rows.length;
    if (frac > MISSING_WARN_FRACTION) {
      console.warn(`  WARN ${sid}: ${label} missing ${(100 * frac).toFixed(1)}% of window`);
    }
  }

  // Feb 29 alone has ~8 samples in 30 years; publish it as the pool of
  // Feb 28 + Feb 29 + Mar 1 so index 59 is as stable as its neighbors.
  const feb29Pool = newAcc();
  addAcc(feb29Pool, accs[FEB29_INDEX - 1]);
  addAcc(feb29Pool, accs[FEB29_INDEX]);
  addAcc(feb29Pool, accs[FEB29_INDEX + 1]);
  accs[FEB29_INDEX] = feb29Pool;

  return accs.map((a, i) => {
    if (a.maxN === 0 || a.minN === 0 || a.pcpnN === 0) {
      throw new Error(`${sid}: no data at all for day index ${i} — refusing to emit gaps`);
    }
    return {
      normalMaxF: round(a.maxSum / a.maxN, 1),
      normalMinF: round(a.minSum / a.minN, 1),
      normalPrecipIn: round(a.pcpnSum / a.pcpnN, 3),
      freezeProbability: round(a.freezeN / a.minN, 3),
      precipProbability: round(a.wetN / a.pcpnN, 3),
    };
  });
}

interface WaypointRow { id: string; stationId: string | null; [k: string]: unknown }
const waypoints: WaypointRow[] = JSON.parse(
  readFileSync(path.join(DATA_DIR, "waypoints.json"), "utf8"),
);
const stationIds = [...new Set(waypoints.map((w) => w.stationId).filter((s): s is string => s !== null))];
if (stationIds.length === 0) {
  console.error("No stationIds in waypoints.json — run scripts/assign-stations.ts first.");
  process.exit(1);
}

console.log(`Fetching ${stationIds.length} stations, ${WINDOW_START}..${WINDOW_END}\n`);
const climate: ClimateData = {};
for (const sid of stationIds) {
  const rows = await fetchStation(sid);
  climate[sid] = computeNormals(sid, rows);
  const jan = climate[sid][14]; // Jan 15
  const jul = climate[sid][196]; // Jul 15
  console.log(
    `${sid.padEnd(13)} Jan15 ${jan.normalMaxF}/${jan.normalMinF}F frz ${Math.round(jan.freezeProbability * 100)}%` +
    `  Jul15 ${jul.normalMaxF}/${jul.normalMinF}F pcp ${Math.round(jul.precipProbability * 100)}%`,
  );
  await new Promise((r) => setTimeout(r, 200)); // be polite to ACIS
}

writeFileSync(OUT_PATH, JSON.stringify(climate) + "\n");
const kb = (JSON.stringify(climate).length / 1024).toFixed(0);
console.log(`\nWrote ${OUT_PATH} (${stationIds.length} stations, ${kb} KB)`);
