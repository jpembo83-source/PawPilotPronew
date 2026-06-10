import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft, Calendar, Heart, Syringe, AlertTriangle, MapPin,
  Sparkles, NotebookPen, Bluetooth, Filter, Lightbulb,
  ShieldCheck, PartyPopper, Activity as ActivityIcon,
} from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { stripEmoji } from "@/lib/text";

type Category =
  | "biometric" | "booking" | "vaccination" | "incident"
  | "stay" | "life_report" | "device" | "note";

interface TimelineEvent {
  id: string;
  ts: string;
  category: Category;
  type: string;
  title: string;
  subtitle?: string;
  data?: Record<string, any>;
  severity?: "info" | "warning" | "error" | "success";
}

interface TimelineResponse {
  pet_id: string;
  from: string;
  to: string;
  total: number;
  days: Array<{ date: string; items: TimelineEvent[] }>;
}

interface PetSummary {
  pet: { id: string; name: string; breed?: string; photoUrl?: string | null };
}

type InsightCategory =
  | "health" | "wellness" | "behavior" | "activity"
  | "preventive" | "tracker" | "celebration";

type InsightSeverity = "good" | "info" | "watch" | "concern";

interface PetInsight {
  id: string;
  generatedAt: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  narrative: string;
  actionable?: string;
  data?: Record<string, any>;
}

interface InsightsResponse {
  pet_id: string;
  generatedAt: string;
  count: number;
  insights: PetInsight[];
}

const ICON: Record<Category, typeof Heart> = {
  biometric:    Heart,
  booking:      Calendar,
  vaccination:  Syringe,
  incident:     AlertTriangle,
  stay:         MapPin,
  life_report:  Sparkles,
  device:       Bluetooth,
  note:         NotebookPen,
};

const TONE: Record<NonNullable<TimelineEvent["severity"]>, string> = {
  info:    "bg-muted text-foreground",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error:   "bg-red-50 text-red-700",
};

const INSIGHT_ICON: Record<InsightCategory, typeof Heart> = {
  health:      Heart,
  wellness:    ShieldCheck,
  behavior:    ActivityIcon,
  activity:    ActivityIcon,
  preventive:  Syringe,
  tracker:     Bluetooth,
  celebration: PartyPopper,
};

const INSIGHT_TONE: Record<InsightSeverity, { wrap: string; chip: string; bar: string }> = {
  good:    { wrap: "bg-emerald-50 border-emerald-200", chip: "text-emerald-700", bar: "bg-emerald-500" },
  info:    { wrap: "bg-card border-border",            chip: "text-foreground",  bar: "bg-slate-300"   },
  watch:   { wrap: "bg-amber-50 border-amber-200",     chip: "text-amber-700",   bar: "bg-amber-500"   },
  concern: { wrap: "bg-red-50 border-red-200",         chip: "text-red-700",     bar: "bg-red-500"     },
};

const INSIGHT_SEV_LABEL: Record<InsightSeverity, string> = {
  good: "Looking good", info: "FYI", watch: "Worth watching", concern: "Needs attention",
};

const ALL_CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: "biometric",   label: "Health" },
  { key: "booking",     label: "Bookings" },
  { key: "vaccination", label: "Vaccinations" },
  { key: "incident",    label: "Incidents" },
  { key: "stay",        label: "Stays" },
  { key: "life_report", label: "Reports" },
  { key: "device",      label: "Tracker" },
  { key: "note",        label: "Notes" },
];

function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function PetTimelineScreen() {
  const { id } = useParams<{ id: string }>();
  const [enabledCats, setEnabledCats] = useState<Set<Category>>(
    new Set(ALL_CATEGORIES.map((c) => c.key))
  );
  const [rangeDays, setRangeDays] = useState(60);

  const fromIso = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - rangeDays);
    return d.toISOString().slice(0, 10);
  }, [rangeDays]);

  const { data: petData } = usePortalQuery<PetSummary>(
    ["portal", "pets", id],
    `/portal/pets/${id}`,
    { enabled: !!id },
  );
  const { data, isLoading } = usePortalQuery<TimelineResponse>(
    ["portal", "pets", id, "timeline", fromIso],
    `/portal/pets/${id}/timeline?from=${fromIso}`,
    { enabled: !!id },
  );
  const { data: insightsData } = usePortalQuery<InsightsResponse>(
    ["portal", "pets", id, "insights"],
    `/portal/pets/${id}/insights`,
    { enabled: !!id },
  );

  const allEvents = useMemo(() => data?.days ?? [], [data]);
  const filtered = useMemo(() => {
    return allEvents
      .map((d) => ({
        date: d.date,
        items: d.items.filter((e) => enabledCats.has(e.category)),
      }))
      .filter((d) => d.items.length > 0);
  }, [allEvents, enabledCats]);

  const totalShown = filtered.reduce((n, d) => n + d.items.length, 0);
  const petName = petData?.pet?.name ?? "Pet";

  function toggle(c: Category) {
    setEnabledCats((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  }

  return (
    <main className="px-5 pt-8 pb-12 max-w-md mx-auto">
      <Link
        to={id ? `/pets/${id}` : "/pets"}
        className="inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        {petName}
      </Link>

      <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground">
        Chronicle
      </p>
      <h1 className="font-display leading-[0.95] tracking-[-0.015em] mt-1 mb-3" style={{ fontSize: 40 }}>
        Timeline
      </h1>
      <p className="text-sm text-muted-foreground mb-5 max-w-[34ch]">
        {petName}'s health, bookings, and tracker activity in one chronological place.
      </p>

      {/* Insights — top of the screen, gives owners the meaning */}
      {insightsData && insightsData.insights.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold">Insights</h2>
            <span className="text-xs text-muted-foreground">· {insightsData.count}</span>
          </div>
          <ul className="space-y-2">
            {insightsData.insights.slice(0, 6).map((ins) => {
              const Icon = INSIGHT_ICON[ins.category];
              const tone = INSIGHT_TONE[ins.severity];
              return (
                <li
                  key={ins.id}
                  className={`relative rounded-2xl border ${tone.wrap} px-4 py-3 overflow-hidden`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar}`} />
                  <div className="flex items-start gap-3 pl-1">
                    <div className={`flex-shrink-0 size-8 rounded-lg bg-white/70 flex items-center justify-center ${tone.chip}`}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-sm font-semibold">{stripEmoji(ins.title)}</p>
                        <span className={`text-[10px] font-medium uppercase tracking-wide ${tone.chip}`}>
                          {INSIGHT_SEV_LABEL[ins.severity]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {stripEmoji(ins.narrative)}
                      </p>
                      {ins.actionable && (
                        <p className={`text-xs mt-1.5 font-medium ${tone.chip}`}>
                          → {ins.actionable}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Range selector */}
      <div className="flex gap-2 mb-3">
        {[14, 30, 60, 180].map((d) => (
          <button
            key={d}
            onClick={() => setRangeDays(d)}
            className={`press flex-1 rounded-lg px-3 py-2 text-xs font-medium border ${
              rangeDays === d
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border"
            }`}
          >
            {d === 180 ? "6 months" : `${d} days`}
          </button>
        ))}
      </div>

      {/* Category filters */}
      <details className="mb-4">
        <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
          <Filter size={14} />
          Filters · {enabledCats.size}/{ALL_CATEGORIES.length} categories
        </summary>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ALL_CATEGORIES.map((c) => {
            const Icon = ICON[c.key];
            const on = enabledCats.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggle(c.key)}
                className={`press inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                  on ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground"
                }`}
              >
                <Icon size={12} />
                {c.label}
              </button>
            );
          })}
        </div>
      </details>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : totalShown === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No events in this range. Try widening the time window or enabling more filters.
        </div>
      ) : (
        <section className="space-y-6">
          {filtered.map(({ date, items }) => (
            <div key={date}>
              <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-background/95 backdrop-blur text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {formatDay(date)}
              </div>
              <ul className="space-y-2">
                {items.map((e) => {
                  const Icon = ICON[e.category];
                  const tone = TONE[e.severity ?? "info"];
                  return (
                    <li
                      key={e.id}
                      className="rounded-xl bg-card border border-border p-3 flex gap-3"
                    >
                      <div className={`flex-shrink-0 size-9 rounded-lg flex items-center justify-center ${tone}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium leading-snug truncate">{stripEmoji(e.title)}</p>
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                            {formatTime(e.ts)}
                          </span>
                        </div>
                        {e.subtitle && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                            {stripEmoji(e.subtitle)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!isLoading && data && (
        <p className="text-xs text-muted-foreground text-center mt-8">
          {data.total} events captured · last {rangeDays} days
        </p>
      )}
    </main>
  );
}
