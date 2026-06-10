/**
 * Composite metric ring — Apple-Fitness-inspired but warmer.
 *
 * Multiple coaxial arcs render together to express a composite score, with a
 * large centred display-serif primary value in the centre.  Long captions live
 * *outside* the ring (below the SVG) to avoid the classic centre-text-overlaps-
 * the-outer-arc collision.  Only number + unit + eyebrow stay inside.
 */

interface Arc {
  /** 0..1 — fraction of the arc to fill */
  value: number;
  /** stroke colour (raw or var()) */
  color: string;
  /** label for screen readers */
  label: string;
}

export interface MetricRingProps {
  /** the headline number rendered in the centre (e.g. 73) */
  primary: number | string;
  /** small unit shown after the number (e.g. "bpm") */
  unit?: string;
  /** small caption rendered BELOW the ring (e.g. "Within typical range · 60–90 bpm") */
  caption?: string;
  /** display-serif eyebrow above the number (e.g. "TODAY") */
  eyebrow?: string;
  /** ordered arcs, outermost first */
  arcs: Arc[];
  /** ring diameter in px */
  size?: number;
  /** ring thickness — defaults to size/14 */
  stroke?: number;
  /** gap between concentric arcs in px */
  gap?: number;
}

export function MetricRing({
  primary, unit, caption, eyebrow,
  arcs, size = 220, stroke, gap = 6,
}: MetricRingProps) {
  const s = stroke ?? Math.max(8, Math.round(size / 14));
  const cx = size / 2;
  const cy = size / 2;

  // The innermost arc's *inner* radius bounds the safe centre region.
  // Anything wider than this circle would overlap the rings — so we clamp
  // the centre-text container to roughly an inscribed square (r·√2).
  const innerR = (size / 2) - s - (arcs.length - 1) * (s + gap);
  const safeBoxPx = Math.max(60, Math.floor(innerR * Math.SQRT2));

  return (
    <div className="inline-flex flex-col items-center">
      {/* The ring itself + centred number/unit overlay */}
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {arcs.map((a, i) => {
            const r = (size / 2) - s / 2 - i * (s + gap);
            if (r < s) return null;
            const circ = 2 * Math.PI * r;
            const clamped = Math.max(0, Math.min(1, a.value));
            return (
              <g key={i}>
                {/* track */}
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke="rgb(28 25 22 / 0.06)"
                  strokeWidth={s}
                />
                {/* progress */}
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={s}
                  strokeLinecap="round"
                  strokeDasharray={`${circ * clamped} ${circ}`}
                  style={{ transition: "stroke-dasharray var(--duration-slow) var(--ease-out)" }}
                >
                  <title>{a.label}</title>
                </circle>
              </g>
            );
          })}
        </svg>

        {/* Centre — only the eyebrow + the headline number live inside the rings.
            The width is clamped to the inscribed-square of the innermost arc so
            we never collide with the arc strokes. */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
        >
          <div
            className="flex flex-col items-center justify-center"
            style={{ width: safeBoxPx, maxWidth: safeBoxPx }}
          >
            {eyebrow && (
              <span className="text-[10px] tracking-[0.20em] uppercase text-muted-foreground font-semibold mb-1.5">
                {eyebrow}
              </span>
            )}
            <span
              className="text-tabular leading-none font-display text-foreground"
              style={{ fontSize: Math.round(size / 4), letterSpacing: "-0.03em" }}
            >
              {primary}
            </span>
            {unit && (
              <span className="text-xs font-medium text-muted-foreground mt-1.5 tracking-wide">
                {unit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Caption sits BELOW the ring — never overlaps the arcs */}
      {caption && (
        <p className="mt-4 text-[13px] text-muted-foreground max-w-[28ch] text-center leading-relaxed">
          {caption}
        </p>
      )}
    </div>
  );
}
