/**
 * CSV export of the hike-conditions data table. Serialization is pure and
 * tested; the download itself goes through planIO's browser glue.
 */
import type { HikeDirection } from "../domain/types";
import { toUnit, type TempUnit } from "../domain/units";

export interface CsvRow {
  name: string;
  trailMile: number; // NOBO mile marker (0 = Springer) in either direction
  elevationFt: number; // trail elevation at the waypoint
  date: string; // ISO yyyy-mm-dd
  lowF: number | null; // °F, converted on output
  highF: number | null;
  wetPct: number | null;
  daylightH: number;
}

const header = (unit: TempUnit) =>
  ["Waypoint", "Mile", "Elevation (ft)", "Date", `Low °${unit}`, `High °${unit}`, "Wet %", "Daylight (h)"];

function cell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Same values the data table shows: elevation, temps and wet % rounded,
 * daylight to 0.1 h; missing weather → empty cell. Temperatures are written
 * in `unit`, which the header names.
 */
export function tableToCsv(rows: CsvRow[], unit: TempUnit = "F"): string {
  const round = (v: number | null) => (v === null ? null : Math.round(v) + 0);
  const temp = (f: number | null) => (f === null ? null : round(toUnit(f, unit)));
  const lines = [
    header(unit),
    ...rows.map((r) => [r.name, r.trailMile.toFixed(1), Math.round(r.elevationFt), r.date, temp(r.lowF), temp(r.highF), round(r.wetPct), r.daylightH.toFixed(1)]),
  ];
  return lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** `StartDate-EndDate-Direction.csv` with compact dates, e.g. `20270301-20270820-NOBO.csv`. */
export function tableCsvFileName(startDate: string, endDate: string, direction: HikeDirection): string {
  const compact = (iso: string) => iso.replace(/-/g, "");
  return `${compact(startDate)}-${compact(endDate)}-${direction}.csv`;
}
