import { useRef, useState } from "react";
import type { Leg } from "../domain/profile";

/**
 * The leg walked INTO a waypoint: gain/loss summary over a mini elevation
 * profile (miles on x, feet on y) with a hover readout. Sparkline style: no
 * axis labels or gridlines — the summary line and the hover readout carry
 * the numbers. One series, so no legend.
 *
 * Height is capped at 90px, so on wide rows the SVG stretches horizontally
 * (preserveAspectRatio="none"). Strokes use non-scaling-stroke and the hover
 * dot is HTML so neither distorts.
 */

const INK_2 = "#52514e";
const MUTED = "#898781";
const SURFACE = "#ffffff";
const ELEV = "#2f8f46"; // terrain green

const W = 520;
const H = 90;
const ML = 2;
const MR = 2;
const MT = 6;
const MB = 2;

const fmtFt = (ft: number) => `${Math.round(ft).toLocaleString()} ft`;

export function LegProfile({ leg, fromName }: { leg: Leg; fromName: string | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const pts = leg.points;
  const d0 = pts[0].milesHiked;
  const dist = (i: number) => pts[i].milesHiked - d0;
  const elevs = pts.map((p) => p.elevationFt);
  const low = Math.min(...elevs);
  const high = Math.max(...elevs);
  const step = high - low > 2000 ? 1000 : 500;
  const yMin = Math.floor(low / step) * step;
  const yMax = Math.max(Math.ceil(high / step) * step, yMin + step);

  const sx = (mi: number) => ML + (mi / Math.max(leg.distanceMi, 0.1)) * (W - ML - MR);
  const sy = (ft: number) => MT + (1 - (ft - yMin) / (yMax - yMin)) * (H - MT - MB);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${sx(dist(i)).toFixed(1)},${sy(p.elevationFt).toFixed(1)}`).join("");
  const area = `M${sx(0).toFixed(1)},${H - MB}${line.replace(/^M/, "L")}L${sx(leg.distanceMi).toFixed(1)},${H - MB}Z`;

  function pick(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    pts.forEach((_, i) => {
      if (Math.abs(sx(dist(i)) - x) < Math.abs(sx(dist(best)) - x)) best = i;
    });
    setHover(best);
  }

  const h = hover === null ? null : pts[hover];

  return (
    <div className="mt-1.5 text-xs text-neutral-500">
      <p>
        <span className="tabular-nums">
          ↑{fmtFt(leg.gainFt)} ↓{fmtFt(leg.lossFt)} over {leg.distanceMi.toFixed(1)} mi
        </span>
        {fromName && <> from {fromName}</>}
      </p>
      <div className="relative mt-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-auto max-h-[90px] w-full touch-none select-none"
          role="img"
          aria-label={`Elevation profile: ${fmtFt(low)} to ${fmtFt(high)} over ${leg.distanceMi.toFixed(1)} miles`}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <path d={area} fill={ELEV} opacity="0.15" />
          <path d={line} fill="none" stroke={ELEV} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {h && hover !== null && (
            <line x1={sx(dist(hover))} x2={sx(dist(hover))} y1={MT} y2={H - MB} stroke={MUTED} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {h && hover !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${(sx(dist(hover)) / W) * 100}%`,
              top: `${(sy(h.elevationFt) / H) * 100}%`,
              background: ELEV,
              boxShadow: `0 0 0 2px ${SURFACE}`,
            }}
          />
        )}
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-md border border-neutral-200 bg-white/95 px-2 py-1 shadow-md"
            style={{
              left: `${Math.min(Math.max((sx(dist(hover)) / W) * 100, 10), 85)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <span className="font-semibold text-neutral-900">{fmtFt(h.elevationFt)}</span>
            <span style={{ color: INK_2 }}> · {dist(hover).toFixed(1)} mi in · trail mi {h.trailMile.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
