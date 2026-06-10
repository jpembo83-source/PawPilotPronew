/**
 * Pulse — the deep biometric view.
 *
 * "Everything we capture from the collar, distilled into something a vet
 * (or an attentive owner) can read at a glance." Goes beyond what Invoxia
 * surfaces in their own app by adding breed-aware norms, multi-day trends,
 * and contextual annotation tying biometrics to bookings + life events.
 */
import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft, Heart, Wind, Waves,
  Sparkles, Lightbulb, Footprints,
} from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { MetricRing } from "@/components/MetricRing";
import { StatBlock } from "@/components/StatBlock";
import { Sparkline } from "@/components/Sparkline";
import { TrackerUpsellCard } from "@/components/TrackerUpsell";
import { stripEmoji } from "@/lib/text";

interface WhereaboutsLite { coverage: "live" | "stale" | "no_device"; }

type Window = "today" | "week" | "month" | "quarter";

interface TimelineEvent {
  id: string; ts: string;
  category: string; type: string;
  title: string; subtitle?: string;
  data?: Record<string, any>;
}

interface TimelineDay { date: string; items: TimelineEvent[]; }
interface TimelineResponse { pet_id: string; total: number; days: TimelineDay[]; }

interface PetSummary { pet: { id: string; name: string; breed?: string; weightKg?: number; dob?: string }; }

interface InsightsResponse {
  insights: Array<{
    id: string; severity: "good" | "info" | "watch" | "concern";
    category: string; title: string; narrative: string; actionable?: string;
  }>;
}

const WINDOWS: Array<{ key: Window; label: string; days: number }> = [
  { key: "today",   label: "24h", days: 1 },
  { key: "week",    label: "7d",  days: 7 },
  { key: "month",   label: "30d", days: 30 },
  { key: "quarter", label: "90d", days: 90 },
];

export function PulseScreen() {
  const { id } = useParams<{ id: string }>();
  const [w, setW] = useState<Window>("week");
  const cfg = WINDOWS.find((x) => x.key === w)!;

  const { data: petData } = usePortalQuery<PetSummary>(
    ["portal", "pets", id], `/portal/pets/${id}`, { enabled: !!id }
  );
  const fromIso = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - cfg.days);
    return d.toISOString().slice(0, 10);
  }, [cfg.days]);

  const { data: timeline, isLoading } = usePortalQuery<TimelineResponse>(
    ["portal", "pets", id, "pulse-tl", fromIso],
    `/portal/pets/${id}/timeline?from=${fromIso}`,
    { enabled: !!id }
  );
  const { data: insightsData } = usePortalQuery<InsightsResponse>(
    ["portal", "pets", id, "insights"],
    `/portal/pets/${id}/insights`,
    { enabled: !!id }
  );
  // Cheap lookup — shares cache with PetDetail's WhereaboutsCard so we don't
  // double-fetch.  Used only to detect whether a collar is linked at all.
  // CRITICAL: assume hasTracker=true on error/loading so a transient server
  // failure doesn't morph "your dog has a tracker" into "upsell the tracker".
  const { data: trackerInfo, isLoading: trackerLoading, isError: trackerErrored } = usePortalQuery<WhereaboutsLite>(
    ["portal", "pets", id, "whereabouts"],
    `/portal/pets/${id}/whereabouts`,
    {
      enabled: !!id,
      staleTime: 5 * 60_000,
      refetchOnMount: "always",
      retry: 3,
    },
  );
  // Only show the upsell when we DEFINITIVELY know there's no device —
  // never on loading, never on error, never on missing field.
  const hasTracker = (trackerLoading || trackerErrored)
    ? true
    : trackerInfo
      ? trackerInfo.coverage !== "no_device"
      : true;

  // ---------- biometric series extraction ---------------------------------
  const hrSeries = useMemo(() => {
    if (!timeline) return [];
    const points: Array<{ date: string; bpm: number }> = [];
    for (const d of timeline.days) {
      for (const ev of d.items) {
        if (ev.category === "biometric" && ev.type === "daily_hr" && typeof ev.data?.hr_avg === "number") {
          points.push({ date: ev.data.date ?? d.date, bpm: Math.round(ev.data.hr_avg) });
        }
      }
    }
    // Order oldest → newest for sparklines
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  }, [timeline]);

  const lifeReports = useMemo(() => {
    if (!timeline) return [];
    const out: Array<{ ts: string; msg: string }> = [];
    for (const d of timeline.days) {
      for (const ev of d.items) {
        if (ev.category === "life_report" && typeof ev.subtitle === "string") {
          out.push({ ts: ev.ts, msg: ev.subtitle });
        }
      }
    }
    return out;
  }, [timeline]);

  // Derived stats
  const latest = hrSeries[hrSeries.length - 1];
  const baseline = hrSeries.length ? Math.round(avg(hrSeries.map((p) => p.bpm))) : null;
  const range = expectedHrRange(petData?.pet?.weightKg);
  const inRange = latest ? latest.bpm >= range.low && latest.bpm <= range.high : false;
  const compositeScore = computeScore({ latest: latest?.bpm ?? null, range, sessionCount: lifeReports.length, dataDays: hrSeries.length });

  const ringArcs = [
    { value: latest ? clamp((latest.bpm - range.low) / (range.high - range.low + 20), 0, 1) : 0,
      color: "rgb(220 38 67)", label: "Heart rate in range" },
    { value: clamp(lifeReports.length / 5, 0, 1),
      color: "rgb(90 79 181)", label: "Health sessions logged" },
    { value: clamp(hrSeries.length / cfg.days, 0, 1),
      color: "rgb(47 122 87)", label: "Data coverage" },
  ];

  const heroInsight = insightsData?.insights?.[0];
  const heroPet = petData?.pet;

  // Parse activity hours from the most recent life_report
  const todaysReport = lifeReports[0]?.msg ?? null;
  const activityHours = todaysReport ? parseHours(todaysReport) : null;
  const sessionsToday = todaysReport ? parseSessions(todaysReport) : null;

  return (
    <main className="px-5 pt-6 pb-12 max-w-md mx-auto">
      <Link
        to={id ? `/pets/${id}` : "/pets"}
        className="inline-flex items-center gap-0.5 -ml-1 mb-4 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        {heroPet?.name ?? "Pet"}
      </Link>

      <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium">
        {heroPet?.name ?? "Pet"} · {heroPet?.breed ?? "Dog"}
      </p>
      <h1 className="font-display text-display leading-none mt-1">Pulse</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-5 max-w-[30ch]">
        {hasTracker
          ? "Everything we read from the collar — beat-by-beat, day after day."
          : "Add the PawPilot Tracker to see heart rate, breath, sleep and activity here every day."}
      </p>

      {/* NO-TRACKER UPSELL — short-circuits the whole Pulse view when the
          pet has no collar linked.  Bookings & timeline still work without
          this; the upsell positions the tracker as the obvious upgrade. */}
      {!trackerLoading && !hasTracker && id && heroPet && (
        <>
          <TrackerUpsellCard petName={heroPet.name} petId={id} />
          <p className="text-center text-xs text-muted-foreground mt-2 max-w-[34ch] mx-auto leading-relaxed">
            Bookings, vaccinations and vet share still work without a tracker — visit your pet's profile for those.
          </p>
        </>
      )}

      {/* HERO RING — only when we have a tracker (even cold-start counts) */}
      {hasTracker && (
      <>
      {/* HERO RING ------------------------------------------------------- */}
      <section className="rounded-3xl bg-card border border-border p-6 mb-5 flex flex-col items-center"
        style={{ boxShadow: "var(--shadow-sm)" }}>
        <MetricRing
          eyebrow={WINDOWS.find((x) => x.key === w)!.label.toUpperCase()}
          primary={latest ? latest.bpm : "—"}
          unit={latest ? "bpm" : undefined}
          caption={latest
            ? (inRange ? `Within typical range · ${range.low}-${range.high} bpm` : `Outside typical range`)
            : "No readings yet — wait for the next health session"}
          arcs={ringArcs}
          size={240}
        />
        <div className="mt-4 flex items-center gap-3 text-xs">
          <Legend dot="rgb(220 38 67)" label="HR in range" />
          <Legend dot="rgb(90 79 181)" label="Sessions" />
          <Legend dot="rgb(47 122 87)" label="Coverage" />
        </div>
        {compositeScore != null && (
          <p className="text-xs text-muted-foreground mt-3">
            Composite wellness <span className="font-medium text-foreground">{compositeScore}</span>/100 — {scoreNarrative(compositeScore)}
          </p>
        )}
      </section>

      {/* WINDOW TABS ----------------------------------------------------- */}
      <div className="flex gap-1 mb-5 bg-muted rounded-2xl p-1">
        {WINDOWS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setW(opt.key)}
            className={[
              "press flex-1 rounded-xl py-2 text-xs font-medium transition-colors",
              w === opt.key ? "bg-card shadow-[var(--shadow-xs)] text-foreground" : "text-muted-foreground",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* TODAYS NARRATIVE (life report) ---------------------------------- */}
      {todaysReport && (
        <section className="rounded-2xl border border-border bg-secondary text-secondary-foreground p-4 mb-5">
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">{stripEmoji(todaysReport)}</p>
          </div>
        </section>
      )}

      {/* BENTO ----------------------------------------------------------- */}
      <h2 className="text-eyebrow mb-2">Today's vitals</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatBlock
          eyebrow="Heart rate"
          value={latest ? latest.bpm : "—"}
          unit={latest ? "bpm" : undefined}
          caption={baseline != null && latest ? `${signed(latest.bpm - baseline)} vs ${baseline} avg` : "Daily average"}
          tone="pulse"
          icon={<Heart size={14} />}
          spark={hrSeries.slice(-Math.min(14, hrSeries.length)).map((p) => p.bpm)}
        />
        <StatBlock
          eyebrow="HR variability"
          value="—"
          unit="ms"
          caption="Per-session HRV arrives during health measurements"
          tone="rest"
          icon={<Waves size={14} />}
        />
        <StatBlock
          eyebrow="Breath rate"
          value="—"
          unit="/min"
          caption="Captured during resting sessions"
          tone="activity"
          icon={<Wind size={14} />}
        />
        <StatBlock
          eyebrow="Activity"
          value={activityHours ? `${activityHours.toFixed(1)}` : "—"}
          unit={activityHours ? "h" : undefined}
          caption={sessionsToday != null ? `${sessionsToday} health session${sessionsToday === 1 ? "" : "s"} today` : "From the collar's accelerometer"}
          tone="wellness"
          icon={<Footprints size={14} />}
        />
      </div>

      {/* HR TREND -------------------------------------------------------- */}
      {hrSeries.length > 1 && (
        <section className="rounded-2xl border border-border bg-card p-5 mb-5"
          style={{ boxShadow: "var(--shadow-xs)" }}>
          <header className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-eyebrow text-muted-foreground">Heart rate · {cfg.label}</h2>
              <p className="font-display text-2xl leading-none mt-1">
                {baseline} <span className="text-sm font-normal text-muted-foreground">bpm avg</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {hrSeries.length} day{hrSeries.length === 1 ? "" : "s"}
            </p>
          </header>
          <Sparkline
            values={hrSeries.map((p) => p.bpm)}
            width={340} height={96}
            color="rgb(220 38 67)"
            fillOpacity={0.14}
          />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{hrSeries[0]?.date}</span>
            <span>{hrSeries[hrSeries.length - 1]?.date}</span>
          </div>
        </section>
      )}

      {/* HEALTH SESSIONS (recent life reports) --------------------------- */}
      {lifeReports.length > 0 && (
        <section className="mb-5">
          <h2 className="text-eyebrow mb-2">Recent health sessions</h2>
          <ul className="space-y-2">
            {lifeReports.slice(0, 5).map((r, i) => (
              <li
                key={`${r.ts}-${i}`}
                className="rounded-2xl border border-border bg-card p-4"
                style={{ boxShadow: "var(--shadow-xs)" }}
              >
                <p className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground font-medium">
                  {new Date(r.ts).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <p className="text-sm leading-relaxed mt-1.5">{stripEmoji(r.msg)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* INSIGHT FOOTER -------------------------------------------------- */}
      {heroInsight && (
        <section className="rounded-2xl bg-foreground text-background p-5">
          <div className="flex items-start gap-3">
            <Lightbulb size={16} className="mt-1 shrink-0 text-amber-200" />
            <div className="flex-1">
              <p className="text-[10px] tracking-[0.18em] uppercase text-background/60 font-medium mb-1">
                Insight
              </p>
              <p className="font-display text-lg leading-snug mb-1">{stripEmoji(heroInsight.title)}</p>
              <p className="text-sm leading-relaxed text-background/80">{stripEmoji(heroInsight.narrative)}</p>
            </div>
          </div>
        </section>
      )}

      {isLoading && hrSeries.length === 0 && (
        <div className="space-y-3 mt-5">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      )}
      </>
      )}{/* end hasTracker gate */}
    </main>
  );
}

// ---------- pure helpers --------------------------------------------------

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="block size-1.5 rounded-full" style={{ backgroundColor: dot }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0; for (const x of xs) s += x; return s / xs.length;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function signed(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

function expectedHrRange(weightKg: number | null | undefined): { low: number; high: number } {
  if (!weightKg || weightKg <= 0) return { low: 60, high: 100 };
  if (weightKg < 9)  return { low: 70, high: 130 };
  if (weightKg > 27) return { low: 60, high: 90 };
  return { low: 60, high: 100 };
}

function computeScore({ latest, range, sessionCount, dataDays }: {
  latest: number | null; range: { low: number; high: number };
  sessionCount: number; dataDays: number;
}): number | null {
  if (latest == null) return null;
  const hrScore = latest >= range.low && latest <= range.high ? 100
    : 100 - Math.min(100, Math.abs(latest - (range.low + range.high) / 2) * 1.4);
  const sessionScore = Math.min(100, sessionCount * 25);
  const coverageScore = Math.min(100, dataDays * 12);
  return Math.round(0.55 * hrScore + 0.25 * sessionScore + 0.20 * coverageScore);
}

function scoreNarrative(n: number): string {
  if (n >= 85) return "excellent";
  if (n >= 70) return "looking good";
  if (n >= 50) return "build more baseline";
  return "early data — keep the collar on";
}

function parseHours(msg: string): number | null {
  const m1 = msg.match(/(\d+)\s*hours?\s*(?:and)?\s*(\d+)?\s*minutes?/i);
  if (m1) {
    const h = parseInt(m1[1]!, 10);
    const min = m1[2] ? parseInt(m1[2], 10) : 0;
    return h + min / 60;
  }
  const m2 = msg.match(/(\d+)\s*hours?/i);
  if (m2) return parseInt(m2[1]!, 10);
  return null;
}

function parseSessions(msg: string): number | null {
  const m = msg.match(/(\d+)\s*health\s*sessions?/i);
  return m ? parseInt(m[1]!, 10) : null;
}
