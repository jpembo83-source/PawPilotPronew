/**
 * Minimal SVG sparkline. Renders a smooth area + line for a small set of
 * values, with optional terminal dot. Used inside bento stat blocks on the
 * Pulse screen and on the Timeline.
 */

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;          // stroke colour (raw or var())
  fillOpacity?: number;
  showDot?: boolean;
  rangeLabel?: string;     // optional aria description
  smooth?: boolean;        // catmull-rom smoothing
}

export function Sparkline({
  values, width = 120, height = 36,
  color = "var(--color-primary)",
  fillOpacity = 0.12,
  showDot = true,
  rangeLabel, smooth = true,
}: SparklineProps) {
  const pad = 2;
  if (values.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const stepX = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / span) * (height - 2 * pad);
    return { x, y };
  });

  const line = smooth ? smoothPath(points) : straightPath(points);
  const area = `${line} L ${points[points.length - 1]!.x},${height - pad} L ${points[0]!.x},${height - pad} Z`;
  const last = points[points.length - 1]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={rangeLabel ?? `Trend of ${values.length} values from ${min.toFixed(1)} to ${max.toFixed(1)}`}
    >
      <path d={area} fill={color} fillOpacity={fillOpacity} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {showDot && (
        <circle cx={last.x} cy={last.y} r={2.6} fill={color} />
      )}
    </svg>
  );
}

function straightPath(p: { x: number; y: number }[]): string {
  return p.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
}

function smoothPath(p: { x: number; y: number }[]): string {
  if (p.length < 3) return straightPath(p);
  const parts: string[] = [`M ${p[0]!.x.toFixed(1)},${p[0]!.y.toFixed(1)}`];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2] ?? p2;
    // Catmull–Rom → cubic Bézier (tension 0.5)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(`C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
  }
  return parts.join(" ");
}
