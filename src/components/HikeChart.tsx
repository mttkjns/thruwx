import { useMemo, useRef, useState } from "react";
import { fullMoonDates } from "../domain/moon";
import { addDays } from "../domain/dates";
import { usePlanStore } from "../state/planStore";
import { downloadText } from "../state/planIO";
import { tableCsvFileName, tableToCsv } from "../state/tableCsv";
import { useSectionProfile } from "../state/useProfile";
import { useProjection, WAYPOINTS } from "../state/useProjection";
import { fmtDate, useTempFormat } from "./format";

/**
 * Conditions along the hike: date on x; four stacked panels (temperature,
 * wet-day chance, daylight, elevation) sharing that axis. Four units means
 * four panels — never a second y-axis. The checkbox row filters series and doubles
 * as the legend (colored line keys + labels). Full moons are muted vertical
 * reference lines across all panels.
 *
 * Colors are the validated 4-slot categorical palette (dataviz skill); the
 * sub-3:1 aqua/yellow marks on this light surface are relieved by the tick
 * labels, the crosshair tooltip, and the data-table view below the chart.
 */

const INK_2 = "#52514e";
const MUTED = "#898781";
const GRID = "#e1e0d9";
const BASE = "#c3c2b7";
const SURFACE = "#ffffff";

const COLOR = {
  low: "#2a78d6", // slot 1 blue
  high: "#eb6834", // slot 2 orange
  wet: "#1baf7a", // slot 3 aqua
  daylight: "#eda100", // slot 4 yellow
  // Neutral ink, not a palette slot: terrain is context for the weather
  // series, not a fifth categorical identity.
  elev: "#7a7972",
};

// viewBox width ≈ the rendered pixel width of the desktop side-by-side column,
// so 1 SVG unit ≈ 1px and font sizes below mean what they say. Total height is
// tuned so the chart card roughly matches the 70vh map beside it.
const W = 560;
const ML = 54; // left margin: y ticks
const MR = 16;
const PANEL_TITLE_H = 26;
const X_AXIS_H = 28;

const NAME_BY_ID = new Map(WAYPOINTS.map((w) => [w.id, w.name]));
const MILE_BY_ID = new Map(WAYPOINTS.map((w) => [w.id, w.trailMile]));
const ELEV_BY_ID = new Map(WAYPOINTS.map((w) => [w.id, w.trailElevationFt]));

interface Pt {
  waypointId: string;
  day: number;
  date: string;
  name: string;
  trailMile: number;
  elevationFt: number;
  lowF: number | null;
  highF: number | null;
  wetPct: number | null;
  daylightH: number;
}

type SeriesKey = "high" | "low" | "wet" | "daylight" | "elev";

function segments(pts: Pt[], get: (p: Pt) => number | null, sx: (d: number) => number, sy: (v: number) => number): string {
  let d = "";
  let pen = false;
  for (const p of pts) {
    const v = get(p);
    if (v === null) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(p.day).toFixed(1)},${sy(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

function areaPath(pts: Pt[], get: (p: Pt) => number | null, sx: (d: number) => number, sy: (v: number) => number, y0: number): string {
  const defined = pts.filter((p) => get(p) !== null);
  if (defined.length < 2) return "";
  const first = defined[0];
  const last = defined[defined.length - 1];
  let d = `M${sx(first.day).toFixed(1)},${y0.toFixed(1)}`;
  for (const p of defined) d += `L${sx(p.day).toFixed(1)},${sy(get(p)!).toFixed(1)}`;
  d += `L${sx(last.day).toFixed(1)},${y0.toFixed(1)}Z`;
  return d;
}

function ticksBetween(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  return out;
}

export function HikeChart({
  onHoverWaypoint,
}: {
  /** Fires with the waypoint id under the cursor (chart or table row), null on leave. */
  onHoverWaypoint?: (waypointId: string | null) => void;
}) {
  const plan = usePlanStore((s) => s.plan);
  const projection = useProjection();
  const profile = useSectionProfile();
  const { unit, symbol, tempWithUnit, toDisplay } = useTempFormat();
  // Temperatures arrive in °F; the chart plots them in the display unit.
  const disp = (f: number | null) => (f === null ? null : toDisplay(f));

  const [show, setShow] = useState<Record<SeriesKey, boolean>>({
    high: true,
    low: true,
    wet: true,
    daylight: true,
    elev: true,
  });
  const [showMoons, setShowMoons] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const pts: Pt[] = useMemo(
    () =>
      projection.waypoints.map((pw) => ({
        waypointId: pw.waypointId,
        day: pw.dayOfHike,
        date: pw.arrivalDate,
        name: NAME_BY_ID.get(pw.waypointId) ?? pw.waypointId,
        trailMile: MILE_BY_ID.get(pw.waypointId) ?? 0,
        elevationFt: ELEV_BY_ID.get(pw.waypointId) ?? 0,
        lowF: pw.weather ? pw.weather.correctedMinF : null,
        highF: pw.weather ? pw.weather.correctedMaxF : null,
        wetPct: pw.weather ? pw.weather.precipProbability * 100 : null,
        daylightH: pw.sun.dayLengthHours,
      })),
    [projection],
  );

  const totalDays = projection.totalDays;
  const moons = useMemo(
    () => fullMoonDates(plan.startDate, totalDays),
    [plan.startDate, totalDays],
  );

  /* ---- scales ---------------------------------------------------- */
  const sx = (day: number) => ML + (day / Math.max(totalDays, 1)) * (W - ML - MR);

  // Range and ticks are computed on display-unit values, so °C gets round
  // ticks (0, 10, 20) rather than converted °F ones.
  const tempVals = pts.flatMap((p) => [disp(p.lowF), disp(p.highF)]).filter((v): v is number => v !== null);
  const tempPad = unit === "C" ? 2 : 4;
  const tempMin = Math.floor(((tempVals.length ? Math.min(...tempVals) : toDisplay(20)) - tempPad) / 10) * 10;
  const tempMax = Math.ceil(((tempVals.length ? Math.max(...tempVals) : toDisplay(90)) + tempPad) / 10) * 10;
  const dayVals = pts.map((p) => p.daylightH);
  const dayMin = Math.floor(Math.min(...dayVals) - 0.5);
  const dayMax = Math.ceil(Math.max(...dayVals) + 0.5);
  // Profile samples sit at their continuous day (miles hiked / pace); the
  // waypoint points above use the schedule's whole days, so a waypoint can
  // sit up to a day left of where the profile passes it.
  const elevPts = profile.map((p) => ({ day: p.milesHiked / plan.paceMilesPerDay, elevationFt: p.elevationFt }));
  const elevVals = elevPts.map((p) => p.elevationFt);
  const elevMin = Math.floor(Math.min(...elevVals) / 1000) * 1000;
  const elevMax = Math.ceil(Math.max(...elevVals) / 1000) * 1000;

  /* ---- panel layout ---------------------------------------------- */
  const showTemp = show.high || show.low;
  interface Panel {
    key: string;
    title: string;
    top: number;
    h: number;
    min: number;
    max: number;
    ticks: number[];
    fmt: (v: number) => string;
  }
  const panels: Panel[] = [];
  // Headroom lane so the full-moon glyphs render whole above the first panel.
  const MOON_LANE_H = 22;
  let cursor = MOON_LANE_H;
  const push = (key: string, title: string, h: number, min: number, max: number, ticks: number[], fmt: (v: number) => string) => {
    cursor += PANEL_TITLE_H;
    panels.push({ key, title, top: cursor, h, min, max, ticks, fmt });
    cursor += h + 14;
  };
  if (showTemp)
    push("temp", `Temperature (${symbol}, corrected)`, 160, tempMin, tempMax,
      ticksBetween(tempMin, tempMax, tempMax - tempMin > 60 ? 20 : 10), (v) => `${v}°`);
  if (show.wet) push("wet", "Chance of a wet day (%)", 90, 0, 100, [0, 50, 100], (v) => `${v}%`);
  if (show.daylight)
    push("daylight", "Daylight (hours)", 90, dayMin, dayMax,
      ticksBetween(dayMin, dayMax, 2), (v) => `${v}h`);
  if (show.elev)
    push("elev", "Trail elevation (ft)", 90, elevMin, elevMax,
      ticksBetween(elevMin, elevMax, elevMax - elevMin > 3000 ? 2000 : 1000), (v) => `${v / 1000}k`);
  const H = cursor + X_AXIS_H;

  const syFor = (p: Panel) => (v: number) => p.top + p.h - ((v - p.min) / (p.max - p.min)) * p.h;

  /* ---- x ticks: month starts ------------------------------------- */
  const monthTicks: { day: number; label: string }[] = [{ day: 0, label: fmtDate(plan.startDate) }];
  for (let d = 1; d <= totalDays; d++) {
    const iso = addDays(plan.startDate, d);
    if (iso.slice(8, 10) === "01") monthTicks.push({ day: d, label: fmtDate(iso) });
  }
  const xTicks = monthTicks.length > 9 ? monthTicks.filter((_, i) => i % 2 === 0) : monthTicks;

  /* ---- hover ------------------------------------------------------ */
  function setHoverBoth(index: number | null) {
    setHover(index);
    onHoverWaypoint?.(index === null ? null : pts[index].waypointId);
  }
  function pickNearest(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const day = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(sx(p.day) - day);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHoverBoth(best);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") setHoverBoth(Math.min((hover ?? -1) + 1, pts.length - 1));
    else if (e.key === "ArrowLeft") setHoverBoth(Math.max((hover ?? 1) - 1, 0));
    else if (e.key === "Escape") setHoverBoth(null);
    else return;
    e.preventDefault();
  }

  const hovered = hover === null ? null : pts[hover];
  const tooltipRows =
    hovered === null
      ? []
      : ([
          show.high && hovered.highF !== null && { key: "high", label: "High", value: tempWithUnit(hovered.highF) },
          show.low && hovered.lowF !== null && { key: "low", label: "Low", value: tempWithUnit(hovered.lowF) },
          show.wet && hovered.wetPct !== null && { key: "wet", label: "Wet chance", value: `${Math.round(hovered.wetPct)}%` },
          show.daylight && { key: "daylight", label: "Daylight", value: `${hovered.daylightH.toFixed(1)}h` },
          show.elev && { key: "elev", label: "Elevation", value: `${hovered.elevationFt.toLocaleString()} ft` },
        ].filter(Boolean) as { key: SeriesKey; label: string; value: string }[]);

  const toggles: { key: SeriesKey; label: string }[] = [
    { key: "high", label: "High temp" },
    { key: "low", label: "Low temp" },
    { key: "wet", label: "Wet chance" },
    { key: "daylight", label: "Daylight" },
    { key: "elev", label: "Elevation" },
  ];

  /* ---- render ------------------------------------------------------ */
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">Conditions along the hike</h2>
        <button
          type="button"
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50"
          onClick={() =>
            downloadText(
              tableToCsv(pts, unit),
              tableCsvFileName(plan.startDate, projection.finishDate, plan.direction),
              "text/csv",
            )
          }
        >
          Export CSV
        </button>
      </div>

      {/* filter row = legend: colored line keys + labels */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-700">
        {toggles.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={show[t.key]}
              onChange={(e) => setShow({ ...show, [t.key]: e.target.checked })}
            />
            <span aria-hidden className="inline-block h-[3px] w-4 rounded" style={{ background: COLOR[t.key] }} />
            {t.label}
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showMoons} onChange={(e) => setShowMoons(e.target.checked)} />
          <span aria-hidden className="inline-block h-[14px] w-px bg-neutral-400" />
          Full moons
        </label>
      </div>

      {panels.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">Everything is hidden — check a series above.</p>
      ) : (
        <div className="relative mt-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none"
            role="img"
            aria-label="Chart of temperature, wet-day chance, daylight, and trail elevation across the hike. Use arrow keys to step through waypoints; values also appear in the data table below."
            tabIndex={0}
            onPointerMove={(e) => pickNearest(e.clientX)}
            onPointerLeave={() => setHoverBoth(null)}
            onKeyDown={onKeyDown}
          >
            {panels.map((p) => {
              const sy = syFor(p);
              return (
                <g key={p.key}>
                  <text x={ML} y={p.top - 7} fontSize="15" fontWeight="600" fill={INK_2}>
                    {p.title}
                  </text>
                  {p.ticks.map((v) => (
                    <g key={v}>
                      <line x1={ML} x2={W - MR} y1={sy(v)} y2={sy(v)} stroke={GRID} strokeWidth="1" />
                      <text x={ML - 6} y={sy(v) + 3.5} fontSize="13" fill={MUTED} textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {p.fmt(v)}
                      </text>
                    </g>
                  ))}
                  <line x1={ML} x2={W - MR} y1={p.top + p.h} y2={p.top + p.h} stroke={BASE} strokeWidth="1" />

                  {p.key === "temp" && (
                    <>
                      {show.high && <path d={segments(pts, (x) => disp(x.highF), sx, sy)} fill="none" stroke={COLOR.high} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
                      {show.low && <path d={segments(pts, (x) => disp(x.lowF), sx, sy)} fill="none" stroke={COLOR.low} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
                    </>
                  )}
                  {p.key === "wet" && (
                    <>
                      <path d={areaPath(pts, (x) => x.wetPct, sx, sy, p.top + p.h)} fill={COLOR.wet} opacity="0.1" />
                      <path d={segments(pts, (x) => x.wetPct, sx, sy)} fill="none" stroke={COLOR.wet} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  )}
                  {p.key === "daylight" && (
                    <>
                      <path d={areaPath(pts, (x) => x.daylightH, sx, sy, p.top + p.h)} fill={COLOR.daylight} opacity="0.1" />
                      <path d={segments(pts, (x) => x.daylightH, sx, sy)} fill="none" stroke={COLOR.daylight} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  )}

                  {p.key === "elev" && (() => {
                    const line = elevPts.map((e, i) => `${i ? "L" : "M"}${sx(e.day).toFixed(1)},${sy(e.elevationFt).toFixed(1)}`).join("");
                    const base = (p.top + p.h).toFixed(1);
                    const area = elevPts.length > 1
                      ? `M${sx(elevPts[0].day).toFixed(1)},${base}${line.replace(/^M/, "L")}L${sx(elevPts[elevPts.length - 1].day).toFixed(1)},${base}Z`
                      : "";
                    return (
                      <>
                        <path d={area} fill={COLOR.elev} opacity="0.15" />
                        <path d={line} fill="none" stroke={COLOR.elev} strokeWidth="1.5" strokeLinejoin="round" />
                      </>
                    );
                  })()}

                  {/* hover markers: ≥8px dot with 2px surface ring */}
                  {hovered &&
                    (p.key === "temp"
                      ? ([show.high && hovered.highF, show.low && hovered.lowF].filter((v) => v !== null && v !== false) as number[]).map((v, i) => (
                          <circle key={i} cx={sx(hovered.day)} cy={sy(toDisplay(v))} r="4.5" fill={i === 0 && show.high ? COLOR.high : COLOR.low} stroke={SURFACE} strokeWidth="2" />
                        ))
                      : p.key === "wet" && hovered.wetPct !== null
                        ? <circle cx={sx(hovered.day)} cy={sy(hovered.wetPct)} r="4.5" fill={COLOR.wet} stroke={SURFACE} strokeWidth="2" />
                        : p.key === "daylight"
                          ? <circle cx={sx(hovered.day)} cy={sy(hovered.daylightH)} r="4.5" fill={COLOR.daylight} stroke={SURFACE} strokeWidth="2" />
                          : p.key === "elev"
                            ? <circle cx={sx(hovered.day)} cy={sy(hovered.elevationFt)} r="4.5" fill={COLOR.elev} stroke={SURFACE} strokeWidth="2" />
                            : null)}
                </g>
              );
            })}

            {/* full-moon reference lines, across all panels */}
            {showMoons &&
              moons.map((iso) => {
                const day = Math.round((Date.parse(iso) - Date.parse(plan.startDate)) / 86_400_000);
                const x = sx(day);
                return (
                  <g key={iso}>
                    <line x1={x} x2={x} y1={20} y2={cursor - 16} stroke={BASE} strokeWidth="1" />
                    <text x={x} y={15} fontSize="13" textAnchor="middle" aria-label={`Full moon ${fmtDate(iso)}`}>
                      🌕
                    </text>
                  </g>
                );
              })}

            {/* crosshair */}
            {hovered && (
              <line x1={sx(hovered.day)} x2={sx(hovered.day)} y1={panels[0].top} y2={cursor - 14} stroke={MUTED} strokeWidth="1" />
            )}

            {/* x axis */}
            {xTicks.map((t) => (
              <text key={t.day} x={sx(t.day)} y={H - 8} fontSize="13" fill={MUTED} textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {t.label}
              </text>
            ))}
          </svg>

          {/* tooltip */}
          {hovered && tooltipRows.length > 0 && (
            <div
              className="pointer-events-none absolute top-1 z-10 rounded-md border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs shadow-md"
              style={{
                left: `${Math.min(Math.max((sx(hovered.day) / W) * 100, 8), 78)}%`,
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-medium text-neutral-900">{hovered.name}</p>
              <p className="text-neutral-500">
                {fmtDate(hovered.date)} · day {hovered.day}
              </p>
              {tooltipRows.map((r) => (
                <p key={r.key} className="mt-0.5 flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-[3px] w-3 rounded" style={{ background: COLOR[r.key] }} />
                  <span className="font-semibold text-neutral-900">{r.value}</span>
                  <span className="text-neutral-500">{r.label}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* table view: the non-hover, non-color path to every value */}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer select-none text-neutral-500 hover:text-neutral-700">
          Data table
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-1 pr-2 font-normal">Waypoint</th>
                <th className="py-1 pr-2 text-right font-normal">Elev ft</th>
                <th className="py-1 pr-2 font-normal">Date</th>
                <th className="py-1 pr-2 text-right font-normal">Low {symbol}</th>
                <th className="py-1 pr-2 text-right font-normal">High {symbol}</th>
                <th className="py-1 pr-2 text-right font-normal">Wet %</th>
                <th className="py-1 text-right font-normal">Daylight</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p, i) => (
                <tr
                  key={`${p.waypointId}-${p.day}`}
                  className="border-t border-neutral-100 hover:bg-sky-50"
                  onMouseEnter={() => setHoverBoth(i)}
                  onMouseLeave={() => setHoverBoth(null)}
                >
                  <td className="py-1 pr-2">{p.name}</td>
                  <td className="py-1 pr-2 text-right">{p.elevationFt.toLocaleString()}</td>
                  <td className="py-1 pr-2">{fmtDate(p.date)}</td>
                  <td className="py-1 pr-2 text-right">{p.lowF === null ? "—" : Math.round(toDisplay(p.lowF)) + 0}</td>
                  <td className="py-1 pr-2 text-right">{p.highF === null ? "—" : Math.round(toDisplay(p.highF)) + 0}</td>
                  <td className="py-1 pr-2 text-right">{p.wetPct === null ? "—" : Math.round(p.wetPct)}</td>
                  <td className="py-1 text-right">{p.daylightH.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
          {moons.length > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              Full moons: {moons.map(fmtDate).join(", ")}.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
