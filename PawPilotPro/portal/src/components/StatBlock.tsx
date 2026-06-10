import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";

/**
 * Bento-grid stat block. Eyebrow label, headline value (with optional unit),
 * supporting line, and an optional sparkline footer. Tone controls the
 * accent colour for the value + sparkline.
 */

type Tone = "neutral" | "pulse" | "activity" | "rest" | "wellness" | "caution" | "concern";

const TONE: Record<Tone, { fg: string; chip: string }> = {
  neutral:  { fg: "var(--color-foreground)",  chip: "var(--color-muted-foreground)" },
  pulse:    { fg: "rgb(220 38 67)",          chip: "rgb(220 38 67)" },
  activity: { fg: "rgb(44 110 132)",         chip: "rgb(44 110 132)" },
  rest:     { fg: "rgb(90 79 181)",          chip: "rgb(90 79 181)" },
  wellness: { fg: "rgb(47 122 87)",          chip: "rgb(47 122 87)" },
  caution:  { fg: "rgb(194 139 44)",         chip: "rgb(194 139 44)" },
  concern:  { fg: "rgb(181 52 58)",          chip: "rgb(181 52 58)" },
};

export interface StatBlockProps {
  eyebrow: string;
  value: string | number;
  unit?: string;
  caption?: string;
  spark?: number[];
  tone?: Tone;
  icon?: ReactNode;
  /** Optional href the whole card links to */
  onClick?: () => void;
  /** Span across columns of the parent grid */
  span?: 1 | 2;
}

export function StatBlock({
  eyebrow, value, unit, caption, spark, tone = "neutral", icon, onClick, span = 1,
}: StatBlockProps) {
  const t = TONE[tone];
  return (
    <article
      onClick={onClick}
      className={[
        "relative overflow-hidden rounded-2xl bg-card border border-border",
        "p-4 pt-4 transition-[transform,box-shadow] duration-200",
        onClick ? "press hover:shadow-[var(--shadow-sm)] cursor-pointer" : "",
        span === 2 ? "col-span-2" : "",
      ].join(" ")}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <header className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground font-medium">
          {eyebrow}
        </span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </header>
      <div className="flex items-baseline gap-1">
        <span
          className="text-tabular font-display"
          style={{ fontSize: 32, lineHeight: 1, color: t.fg }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-muted-foreground">{unit}</span>
        )}
      </div>
      {caption && (
        <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
          {caption}
        </p>
      )}
      {spark && spark.length > 1 && (
        <div className="mt-3 -mx-1">
          <Sparkline values={spark} width={200} height={28} color={t.chip} fillOpacity={0.1} />
        </div>
      )}
    </article>
  );
}
