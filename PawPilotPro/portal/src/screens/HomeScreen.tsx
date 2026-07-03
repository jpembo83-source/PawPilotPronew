import { Link } from "react-router-dom";
import {
  ArrowUpRight, ArrowRight, Plus, PawPrint, Syringe, FileWarning,
  Lightbulb, Heart, ShieldCheck, Activity as ActivityIcon, Bluetooth,
  PartyPopper,
  Sun, Scissors, Moon, Truck,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { getPortalApi } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { NotificationBell } from "@/components/NotificationBell";
import { Sparkline } from "@/components/Sparkline";
import { PetSwitcherStrip } from "@/components/PetSwitcherStrip";
import { TrackerUpsellRow } from "@/components/TrackerUpsell";
import { TodayCard } from "@/components/TodayCard";
import { useHeroPetStore } from "@/stores/heroPetStore";
import { stripEmoji } from "@/lib/text";
import type { Booking } from "@shared/types/booking";
import type { Pet } from "@shared/types/pet";

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
}

interface InsightsResponse { pet_id: string; count: number; insights: PetInsight[]; }

interface TimelineEv { id: string; ts: string; category: string; type: string; title: string; subtitle?: string; data?: any; }
interface TimelineResponse { days: Array<{ date: string; items: TimelineEv[] }>; }

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
const SEV_RANK: Record<InsightSeverity, number> = { concern: 0, watch: 1, info: 2, good: 3 };

interface HomeData {
  greeting: { firstName: string; tenantName: string };
  upcoming: Array<Booking & { petNames?: string[] }>;
  alerts: {
    vaxExpiring: Array<{ petId: string; vaxType: string; expiresAt: string }>;
    documentsExpiring?: Array<{
      id: string;
      name: string;
      documentType: string;
      expiresAt: string;
    }>;
    pendingRequests: number;
  };
}

const SERVICE_LABEL: Record<string, string> = {
  daycare: "Daycare",
  grooming: "Grooming",
  overnights: "Overnights",
  transport: "Transport",
};
const SERVICE_ICON: Record<string, typeof Sun> = {
  daycare:    Sun,
  grooming:   Scissors,
  overnights: Moon,
  transport:  Truck,
};

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function relativeDay(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.floor((date.getTime() - startOfToday) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function HomeScreen() {
  const { data, isLoading } = usePortalQuery<HomeData>(["portal", "home"], "/portal/home");
  const { data: petsData } = usePortalQuery<{ pets: Pet[] }>(["portal", "pets"], "/portal/pets");
  const { heroPetId: storedHeroPetId } = useHeroPetStore();

  // Resolve which pet is currently featured:
  //   1. The one the owner explicitly picked via PetSwitcherStrip (persisted).
  //   2. Else the first pet with a photo (so the hero image isn't empty).
  //   3. Else just the first pet.
  // Guard against the stored id pointing at a pet that no longer exists
  // (deleted from the household) by falling through to the photo/first
  // fallbacks rather than rendering an undefined hero.
  const allPets = petsData?.pets ?? [];
  const storedPet = storedHeroPetId
    ? allPets.find((p) => p.id === storedHeroPetId)
    : null;
  const heroPet =
    storedPet ?? allPets.find((p) => p.photoUrl) ?? allPets[0];
  const heroPhoto = heroPet?.photoUrl ?? null;

  // Fetch insights for every pet in parallel. The results are aggregated
  // client-side — top 4 across the household by severity.
  const insightQueries = useQueries({
    queries: (petsData?.pets ?? []).map((p) => ({
      queryKey: ["portal", "pets", p.id, "insights"],
      queryFn: () => getPortalApi().get<InsightsResponse>(`/portal/pets/${p.id}/insights`),
      staleTime: 60_000,
    })),
  });
  // Quick biometric snapshot for the hero pet (the one whose photo appears).
  // Mirrors the heroPet resolution above so PulseHero + timeline track the
  // owner's switcher pick.
  const heroPetId = heroPet?.id;
  const heroFromIso = (() => {
    const d = new Date(); d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  })();
  const { data: heroTimeline } = usePortalQuery<TimelineResponse>(
    ["portal", "pets", heroPetId, "home-tl", heroFromIso],
    `/portal/pets/${heroPetId}/timeline?from=${heroFromIso}`,
    { enabled: !!heroPetId },
  );
  const heroHrSeries = (() => {
    if (!heroTimeline) return [] as number[];
    const out: Array<{ date: string; bpm: number }> = [];
    for (const d of heroTimeline.days) {
      for (const ev of d.items) {
        if (ev.category === "biometric" && ev.type === "daily_hr" && typeof ev.data?.hr_avg === "number") {
          out.push({ date: ev.data.date ?? d.date, bpm: Math.round(ev.data.hr_avg) });
        }
      }
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.map((p) => p.bpm);
  })();
  const heroLatestHr = heroHrSeries[heroHrSeries.length - 1];
  const heroHrDays = heroHrSeries.length;

  const householdInsights = ((): Array<{ petId: string; petName: string; insight: PetInsight }> => {
    if (!petsData?.pets) return [];
    const out: Array<{ petId: string; petName: string; insight: PetInsight }> = [];
    for (let i = 0; i < petsData.pets.length; i++) {
      const p = petsData.pets[i]!;
      const q = insightQueries[i];
      const items = (q?.data as InsightsResponse | undefined)?.insights ?? [];
      for (const ins of items) out.push({ petId: p.id, petName: p.name, insight: ins });
    }
    out.sort((a, b) => SEV_RANK[a.insight.severity] - SEV_RANK[b.insight.severity]);
    return out.slice(0, 4);
  })();

  return (
    <main className="max-w-md mx-auto pb-4">
      {/* HERO ------------------------------------------------------------ */}
      <section className="relative" style={{ marginTop: "calc(-1 * var(--safe-top))" }}>
        <div className="relative h-[300px] overflow-hidden bg-background">
          {/* Photo only renders once we actually have one. While loading we
              keep the cream background — no broken pink-paw fallback that
              the SplashCurtain would have to hide.  When the photo finally
              loads it fades in. */}
          {heroPhoto && (
            <img
              src={heroPhoto}
              alt=""
              className="absolute inset-0 w-full h-full object-cover anim-fade-in"
            />
          )}
          {/* Cream→content scrim — kept even without a photo so the eventual
              greeting text gets the same legibility treatment. */}
          <div className="absolute inset-0" style={{ background: "var(--hero-overlay)" }} aria-hidden="true" />

          {/* bell, safe-area aware */}
          <div className="absolute right-5 flex" style={{ top: "calc(0.75rem + var(--safe-top))" }}>
            <div className="rounded-full bg-card/70 backdrop-blur-sm">
              <NotificationBell />
            </div>
          </div>

          {/* greeting sits low, over the cream fade */}
          <div className="absolute inset-x-0 bottom-0 px-5 pb-3">
            {isLoading || !data ? (
              <>
                <Skeleton className="h-3.5 w-24 mb-2" />
                <Skeleton className="h-9 w-52" />
              </>
            ) : (
              <>
                <p className="text-eyebrow mb-1.5">{greetingWord()}</p>
                <h1 className="text-display leading-[1.02]">{data.greeting.firstName}</h1>
              </>
            )}
          </div>
        </div>
      </section>

      {/* PET SWITCHER STRIP — multi-pet households get a small horizontal
          strip just below the hero so the owner can pick which pet is
          featured.  Hidden entirely for single-pet households. */}
      <PetSwitcherStrip pets={allPets} />

      <div className="px-5 -mt-1">
        {/* TODAY — staff-driven day feed for the featured pet. Sits above
            the biometric surfaces: "Rex arrived 8:42" + a photo from the
            yard is the answer to "how is my dog right now". Renders only
            when there is at least one update today. */}
        {heroPetId && heroPet && (
          <TodayCard petId={heroPetId} petName={heroPet.name} />
        )}

        {/* PULSE HERO — the editorial centerpiece for collar owners.
            Big tabular display number that breathes, ambient ECG trace,
            pulsing status pill, full-width sparkline.

            When the FEATURED pet has no Invoxia collar bound (hasTracker
            false on the wire pet) the pulse surface is dropped entirely
            and the tracker pitch collapses to a single compact row BELOW
            the Up next section — the Today feed and next bookings take
            the prime real estate, and the tracker suite is opt-in-by-
            possession rather than default clutter. Collar owners keep
            the current layout unchanged. */}
        {heroPetId && heroPet?.hasTracker !== false && (
          <PulseHero
            petId={heroPetId}
            petName={heroPet?.name ?? ""}
            latestHr={heroLatestHr}
            series={heroHrSeries}
            days={heroHrDays}
          />
        )}

        {/* UP NEXT ------------------------------------------------------- */}
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-eyebrow">Up next</h2>
            {!isLoading && data && data.upcoming.length > 0 && (
              <Link to="/bookings" className="press text-xs font-semibold text-primary inline-flex items-center gap-0.5">
                All bookings <ArrowUpRight size={12} strokeWidth={2.5} />
              </Link>
            )}
          </div>

          {isLoading || !data ? (
            <Skeleton className="h-[92px] rounded-2xl" />
          ) : data.upcoming.length === 0 ? (
            <EmptyUpcoming />
          ) : (
            <ul className="space-y-2.5">
              {data.upcoming.map((b, i) => {
                const ServiceIcon = SERVICE_ICON[b.service] ?? PawPrint;
                return (
                <li key={b.id} className="anim-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link
                    to={`/bookings/${b.id}`}
                    className="press group block bg-card border border-border rounded-[1.25rem] p-3.5 hover:border-primary/40 transition-colors"
                    style={{ boxShadow: "var(--shadow-card-soft)" }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="size-12 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
                        <ServiceIcon size={18} strokeWidth={2} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h3 className="font-semibold text-[15px] truncate">{SERVICE_LABEL[b.service] ?? b.service}</h3>
                          <StatusBadge status={b.status} />
                        </div>
                        <p className="text-[13px] text-foreground text-tabular">
                          {relativeDay(b.startAt)} · {new Date(b.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {b.petNames && b.petNames.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.petNames.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tracker pitch — compact, below the day's real content. */}
        {heroPetId && heroPet?.hasTracker === false && (
          <TrackerUpsellRow petName={heroPet?.name ?? "your pet"} petId={heroPetId} />
        )}

        {/* INSIGHTS ------------------------------------------------------ */}
        {householdInsights.length > 0 && (
          <section className="mb-6">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-eyebrow flex items-center gap-1.5">
                <Lightbulb size={12} className="text-amber-600" />
                Today's insights
              </h2>
            </div>
            <ul className="space-y-2">
              {householdInsights.map(({ petId, petName, insight: ins }) => {
                const Icon = INSIGHT_ICON[ins.category];
                const tone = INSIGHT_TONE[ins.severity];
                const multiPet = (petsData?.pets.length ?? 0) > 1;
                return (
                  <li key={`${petId}-${ins.id}`}>
                    <Link
                      to={`/pets/${petId}/timeline`}
                      className={`press relative block rounded-2xl border ${tone.wrap} px-4 py-3 overflow-hidden`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar}`} />
                      <div className="flex items-start gap-3 pl-1">
                        <div className={`flex-shrink-0 size-8 rounded-lg bg-white/70 flex items-center justify-center ${tone.chip}`}>
                          <Icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-sm font-semibold leading-snug">
                              {stripEmoji(ins.title)}
                              {multiPet && (
                                <span className="text-xs font-normal text-muted-foreground"> · {petName}</span>
                              )}
                            </p>
                            <ArrowUpRight size={14} className={tone.chip} />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {stripEmoji(ins.narrative)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* PRIMARY CTA — dark off-black, deterministic. Renders confidently
            regardless of tenant brand colour. Subtle inner-highlight via
            shadow-card-soft, plus an arrow that nudges on hover. */}
        <Link
          to="/book"
          className="press group relative inline-flex items-center justify-center gap-2.5 w-full h-14 rounded-[1.25rem] bg-foreground text-background font-semibold mb-6 hover:opacity-[0.96] transition-opacity overflow-hidden"
          style={{ boxShadow: "var(--shadow-card-soft)" }}
        >
          <span className="absolute inset-x-0 top-0 h-px bg-white/10 pointer-events-none" aria-hidden="true" />
          <Plus size={18} strokeWidth={2.4} />
          <span className="tracking-[-0.005em] text-[15px]">Book a service</span>
          <ArrowRight
            size={15} strokeWidth={2.4}
            className="absolute right-5 opacity-55 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>

        {/* ALERTS — stack of small action cards. Each alert points to the
            screen where the owner can act on it. Order: vax first (more
            time-sensitive — affects bookings), documents second. */}
        <div className="space-y-2.5">
          {!isLoading && data && data.alerts.vaxExpiring.length > 0 && (
            <Link
              to="/pets"
              className="press anim-fade-in block rounded-2xl border border-primary/20 bg-secondary p-4"
            >
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-xl grid place-items-center shrink-0 bg-primary/10 text-primary">
                  <Syringe size={16} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold leading-tight mb-0.5 text-primary">
                    Vaccinations need attention
                  </h3>
                  <p className="text-[13px] text-secondary-foreground">
                    {data.alerts.vaxExpiring.length === 1
                      ? "1 expires in the next 30 days."
                      : `${data.alerts.vaxExpiring.length} expire in the next 30 days.`}
                  </p>
                </div>
                <ArrowUpRight className="shrink-0 mt-0.5 text-primary" size={16} strokeWidth={2.5} />
              </div>
            </Link>
          )}

          {!isLoading && data && (data.alerts.documentsExpiring?.length ?? 0) > 0 && (
            <Link
              to="/account/documents"
              className="press anim-fade-in block rounded-2xl border border-primary/20 bg-secondary p-4"
            >
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-xl grid place-items-center shrink-0 bg-primary/10 text-primary">
                  <FileWarning size={16} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold leading-tight mb-0.5 text-primary">
                    Documents need attention
                  </h3>
                  <p className="text-[13px] text-secondary-foreground">
                    {data.alerts.documentsExpiring!.length === 1
                      ? "1 document expires soon."
                      : `${data.alerts.documentsExpiring!.length} documents expire soon.`}
                  </p>
                </div>
                <ArrowUpRight className="shrink-0 mt-0.5 text-primary" size={16} strokeWidth={2.5} />
              </div>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function EmptyUpcoming() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-7 text-center">
      <div className="size-10 rounded-full bg-secondary text-secondary-foreground grid place-items-center mx-auto mb-3">
        <PawPrint size={18} />
      </div>
      <h3 className="font-semibold text-[15px] mb-1">Nothing booked yet</h3>
      <p className="text-[13px] text-muted-foreground">
        Tap <span className="text-foreground font-medium">Book a service</span> to send your first request.
      </p>
    </div>
  );
}

/* ─── PULSE HERO ──────────────────────────────────────────────────────
   The editorial centrepiece of the home screen. Bento 2.0 vocabulary:
     • Generous 2rem corner radius and a warm diffusion shadow.
     • 72px Fraunces tabular numeral that perpetually breathes.
     • A pulsing-dot status pill, computed against a resting band.
     • A subtle ambient ECG-trace SVG (drift-dash) for cold-start runs.
     • A full-width smoothed sparkline once we have ≥2 daily readings.
     • Three monospaced micro-stats under a thin divider.
   This is the single moment that has to stop your thumb on first load.
─────────────────────────────────────────────────────────────────────── */
const HR_RANGE_LOW = 60;
const HR_RANGE_HIGH = 90;

function PulseHero({
  petId, petName, latestHr, series, days,
}: {
  petId: string;
  petName: string;
  latestHr: number | undefined;
  series: number[];
  days: number;
}) {
  const hasData = typeof latestHr === "number";
  const prevHr = series.length >= 2 ? series[series.length - 2] : null;
  const delta = hasData && prevHr != null ? (latestHr as number) - (prevHr as number) : null;

  let status: { label: string; tone: "good" | "watch" };
  if (!hasData) {
    status = { label: "Awaiting first reading", tone: "watch" };
  } else if ((latestHr as number) < HR_RANGE_LOW) {
    status = { label: "Below resting band", tone: "watch" };
  } else if ((latestHr as number) > HR_RANGE_HIGH) {
    status = { label: "Elevated", tone: "watch" };
  } else {
    status = { label: "In normal range", tone: "good" };
  }

  const tone = status.tone === "good"
    ? { dot: "bg-emerald-500", text: "text-emerald-700", pill: "bg-emerald-50/80 border-emerald-200/70" }
    : { dot: "bg-amber-500",   text: "text-amber-700",   pill: "bg-amber-50/80 border-amber-200/70"     };

  return (
    <Link
      to={`/pets/${petId}/pulse`}
      className="press group relative block mb-6 overflow-hidden rounded-[2rem] bg-card border border-border/60"
      style={{ boxShadow: "var(--shadow-diffusion)" }}
      aria-label={`Open ${petName || "pet"} pulse — latest heart rate ${hasData ? latestHr + " bpm" : "no data"}`}
    >
      {/* Soft radial tint from brand secondary in the top-left corner.
          Gives dimension without printing a heavy fill. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--secondary) 75%, transparent) 0%, transparent 55%)",
        }}
      />

      {/* Ambient drifting ECG trace — only shown when we don't yet have a
          real sparkline to display. Decorative, low-opacity. */}
      {series.length < 2 && (
        <svg
          className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.09]"
          width="220" height="72" viewBox="0 0 220 72" fill="none" aria-hidden="true"
        >
          <path
            d="M0,36 L34,36 L42,36 L48,16 L56,56 L64,8 L72,62 L82,36 L120,36 L128,36 L134,22 L142,50 L150,36 L220,36"
            stroke="rgb(220 38 67)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="6 5" className="animate-drift-dash"
          />
        </svg>
      )}

      <div className="relative p-6 pt-5">
        {/* Eyebrow row: tiny label + pulsing status pill */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
            Pulse{petName ? ` — ${petName}` : ""}
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10px] font-semibold tracking-wide ${tone.pill} ${tone.text}`}
          >
            <span className={`inline-block size-1.5 rounded-full ${tone.dot} animate-pulse-dot`} aria-hidden="true" />
            {status.label}
          </span>
        </div>

        {/* The number itself — Fraunces tabular, breathing on the spot.
            Right side carries a small delta vs the previous reading. */}
        <div className="mt-4 flex items-baseline gap-2">
          <span
            className="font-display text-tabular text-foreground leading-none animate-breathe"
            style={{ fontSize: 72, letterSpacing: "-0.035em" }}
          >
            {hasData ? latestHr : "—"}
          </span>
          {hasData && (
            <span className="text-sm font-medium text-muted-foreground tracking-wide -mb-1">
              bpm
            </span>
          )}
          {delta != null && delta !== 0 && (
            <span
              className={`ml-auto inline-flex items-baseline gap-1 text-[11px] font-semibold tabular-nums ${
                delta > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
              <span className="text-muted-foreground font-medium">vs last</span>
            </span>
          )}
        </div>

        {/* Either the live trend OR a calm explanation line.  We don't draw
            a fake/single-point sparkline — silence beats noise. */}
        {series.length > 1 ? (
          <div className="mt-5 -mx-1">
            <Sparkline
              values={series}
              width={320}
              height={56}
              color="rgb(220 38 67)"
              fillOpacity={0.10}
              showDot
            />
          </div>
        ) : (
          <p className="relative mt-5 text-[13px] text-muted-foreground leading-relaxed max-w-[34ch]">
            {hasData
              ? "First reading captured. Two more daily sessions and we'll plot the trend."
              : "The collar reports after the next health session — usually within a day."}
          </p>
        )}

        {/* Micro-stats footer.  Monospaced numerals, separated by a hair-thin
            divider — Bento 2.0 / Cockpit-style data row inside an Art-Gallery
            card.  Chevron sits flush right as the affordance. */}
        <div className="mt-5 flex items-end justify-between gap-4 pt-4 border-t border-border/60">
          <Stat label="Resting" value={`${HR_RANGE_LOW}–${HR_RANGE_HIGH}`} unit="bpm" />
          <Stat label="Today"   value={hasData ? String(latestHr) : "—"}   unit="bpm" />
          <Stat label="Window"  value={String(days)}                       unit={days === 1 ? "day" : "days"} />
          <ArrowUpRight
            size={16} strokeWidth={2.2}
            className="mb-0.5 shrink-0 text-muted-foreground/65 transition-all duration-200 group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-[0.20em] font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-[15px] font-semibold text-foreground text-tabular leading-none">
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">{unit}</span>
      </span>
    </div>
  );
}
