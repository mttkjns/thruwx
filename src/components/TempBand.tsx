import { fmtTemp, tempColor } from "./format";

/** Shared scale across all rows so the cold→warm→cold arc reads down the page. */
const SCALE_MIN_F = -10;
const SCALE_MAX_F = 100;
const FREEZE_F = 32;

const pct = (f: number) =>
  (100 * (f - SCALE_MIN_F)) / (SCALE_MAX_F - SCALE_MIN_F);

/**
 * A low→high temperature bar on a fixed -10..100°F scale, with a tick at
 * freezing. Rendered per waypoint row; stacked rows form the seasonal arc.
 */
export function TempBand({ lowF, highF }: { lowF: number; highF: number }) {
  const left = pct(lowF);
  const width = Math.max(pct(highF) - left, 1.5);
  return (
    <div
      className="relative h-2.5 w-full rounded-full bg-neutral-200/70"
      role="img"
      aria-label={`Low ${fmtTemp(lowF)}, high ${fmtTemp(highF)}`}
    >
      {/* freeze tick */}
      <div
        className="absolute top-[-3px] bottom-[-3px] w-px bg-neutral-400"
        style={{ left: `${pct(FREEZE_F)}%` }}
        aria-hidden
      />
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          background: `linear-gradient(90deg, ${tempColor(lowF)}, ${tempColor(highF)})`,
        }}
        aria-hidden
      />
    </div>
  );
}
