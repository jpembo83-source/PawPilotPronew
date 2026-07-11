import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Plus, Pencil, Phone, MapPin, Heart, AlertCircle, Bluetooth, Activity, Stethoscope, Waves, Navigation, Clock, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Images } from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { Sparkline } from "@/components/Sparkline";
import { TrackerUpsellCard } from "@/components/TrackerUpsell";
import { PetPhotoEditor } from "@/components/PetPhotoEditor";
import { MiniMap } from "@/components/MiniMap";
import { stripEmoji } from "@/lib/text";
import type { Pet } from "@shared/types/pet";
import type { Vaccination, VaxStatus } from "@shared/types/vaccination";

interface DeviceStatus {
  battery_pct: number | null;
  charging:    boolean | null;
  state:       string;
  lowBattery:  boolean;
  offline:     boolean;
  lastSyncedAt: string | null;
  network:      string | null;
  subscriptionEnds: string | null;
}

interface WhereaboutsResponse {
  lastSeen: { lat: number; lng: number; accuracy_m: number; recorded_at: string; method: number } | null;
  positions: Array<{ ts: string; lat: number; lng: number; accuracy_m: number }>;
  stays: Array<{ startedAt: string; endedAt: string; durationSec: number; pointCount: number; lat: number; lng: number }>;
  coverage: "live" | "stale" | "no_device";
  deviceStatus: DeviceStatus | null;
}

interface ActivityResponse {
  today: { activeHours: number | null; sessions: { count: number; minutes: number } | null; reportAt: string } | null;
  hrSeries: Array<{ date: string; hr_avg: number }>;
  lastActivity: string | null;
  lastHealth:   string | null;
  reports: Array<{ ts: string; msg: string; type: string }>;
}

function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1)            return "just now";
  if (min < 60)           return `${min} min ago`;
  if (min < 60 * 24)      return `${Math.round(min / 60)} h ago`;
  if (min < 60 * 24 * 7)  return `${Math.round(min / 1440)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

interface PetDetailData {
  pet: Pet;
  vaccinations: Vaccination[];
}

function vaxStatus(v: Vaccination): VaxStatus {
  const exp = new Date(v.expiresAt).getTime();
  const now = Date.now();
  if (exp < now) return "expired";
  if (exp - now < 30 * 86_400_000) return "expiring";
  return "current";
}

const VAX_STYLE: Record<VaxStatus, string> = {
  current: "bg-secondary text-secondary-foreground",
  expiring: "bg-muted text-foreground",
  expired: "bg-destructive/10 text-destructive",
};

const VAX_LABEL: Record<VaxStatus, string> = {
  current: "Current",
  expiring: "Expiring",
  expired: "Expired",
};

const VAX_TYPE_LABEL: Record<string, string> = {
  rabies: "Rabies",
  dhpp: "DHPP",
  bordetella: "Bordetella",
  leptospirosis: "Leptospirosis",
  influenza: "Canine Influenza",
  other: "Other",
};
function vaxTypeLabel(t: string): string {
  return VAX_TYPE_LABEL[t?.toLowerCase()] ?? (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Vaccination");
}

function ageFrom(dob: string): string {
  const ms = Date.now() - new Date(dob).getTime();
  if (ms <= 0) return "—";
  const years = ms / (365.25 * 86_400_000);
  return years < 1 ? `${Math.round(years * 12)} mo` : `${Math.floor(years)} yr`;
}

const SEX_LABEL = { male: "Male", female: "Female", unknown: "—" } as const;
const NEUTERED_LABEL = { neutered: "Yes", intact: "No", unknown: "—" } as const;

export function PetDetailScreen() {
  const { id } = useParams();
  const { data, isLoading } = usePortalQuery<PetDetailData>(
    ["portal", "pets", id],
    `/portal/pets/${id}`,
    { enabled: !!id },
  );

  if (isLoading || !data) {
    return (
      <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
        <Skeleton className="h-4 w-20 mb-5" />
        <div className="flex items-start gap-4 mb-7">
          <Skeleton className="size-24 rounded-full" />
          <div className="flex-1 pt-2">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </main>
    );
  }

  const p = data.pet;
  const pending = p.verificationStatus === "pending_staff_review";
  const rejected = p.verificationStatus === "rejected";
  const hasOwnerNotes = !!p.ownerNotes?.trim();
  const hasTeamNotes = !!(p.teamBehaviourNotes?.trim() || p.teamMedicalNotes?.trim());

  return (
    <main className="px-5 pt-8 max-w-md mx-auto pb-12">
      {/* BACK ---------------------------------------------------------- */}
      <Link
        to="/pets"
        className="press inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        All pets
      </Link>

      {/* HEADER -------------------------------------------------------- */}
      <header className="flex items-start gap-4 mb-3 anim-fade-in">
        {id && (
          <PetPhotoEditor
            petId={id}
            petName={p.name}
            photoUrl={p.photoUrl}
            size={96}
          />
        )}
        <div className="min-w-0 pt-1.5 flex-1">
          <h1 className="text-display-sm leading-tight truncate">{p.name}</h1>
          {p.breed && <p className="text-eyebrow mt-2 truncate">{p.breed}</p>}
          <p className="text-[13px] text-muted-foreground text-tabular mt-2">
            {ageFrom(p.dob)} {p.weightKg ? `· ${p.weightKg} kg` : ""}
          </p>
        </div>
      </header>

      {/* PENDING BANNER + EDIT BUTTON --------------------------------- */}
      {pending && (
        <div className="flex items-start gap-2.5 rounded-xl bg-secondary/60 border border-primary/20 text-[13px] p-3.5 mb-3 anim-fade-in">
          <AlertCircle size={15} strokeWidth={2.2} className="shrink-0 mt-px text-primary" />
          <p className="leading-relaxed">
            <span className="font-semibold">Awaiting team verification.</span>{" "}
            You can edit details now — they'll be confirmed alongside identity.
          </p>
        </div>
      )}
      {rejected && (
        <div className="flex items-start gap-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-sm p-3.5 mb-3 anim-fade-in">
          <AlertCircle size={15} strokeWidth={2.2} className="shrink-0 mt-px text-destructive" />
          <p className="leading-relaxed">
            <span className="font-semibold">We couldn't verify {p.name}.</span>{" "}
            The team's reason is in your notifications and inbox — get in touch and we'll sort it out together.
          </p>
        </div>
      )}

      {/* Primary CTA — distinct from secondary actions */}
      <Link
        to={`/pets/${id}/pulse`}
        className="press relative block w-full h-14 mb-3 rounded-2xl bg-foreground text-background overflow-hidden"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <div className="absolute inset-0 flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Waves size={18} strokeWidth={2.2} className="text-background/70" />
            <span className="font-display text-base">View Pulse</span>
          </div>
          <span className="text-[10px] tracking-[0.16em] uppercase text-background/60 font-medium">
            Heart rate · Activity · Trends
          </span>
        </div>
      </Link>

      {/* Secondary actions */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <Link
          to={`/pets/${id}/timeline`}
          className="press inline-flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-card border border-border text-[11px] font-medium hover:border-primary/40"
        >
          <Activity size={14} strokeWidth={2.2} />
          Timeline
        </Link>
        <Link
          to={`/gallery?pet=${id}`}
          className="press inline-flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-card border border-border text-[11px] font-medium hover:border-primary/40"
        >
          <Images size={14} strokeWidth={2.2} />
          Photos
        </Link>
        <Link
          to={`/pets/${id}/tracker`}
          className="press inline-flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-card border border-border text-[11px] font-medium hover:border-primary/40"
        >
          <Bluetooth size={14} strokeWidth={2.2} />
          Tracker
        </Link>
        <Link
          to={`/pets/${id}/vet-share`}
          className="press inline-flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-card border border-border text-[11px] font-medium hover:border-primary/40"
        >
          <Stethoscope size={14} strokeWidth={2.2} />
          Vet
        </Link>
        <Link
          to={`/pets/${id}/edit`}
          className="press inline-flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-card border border-border text-[11px] font-medium hover:border-primary/40"
        >
          <Pencil size={14} strokeWidth={2.2} />
          Edit
        </Link>
      </div>

      {/* CLOUD-DERIVED SURFACES ----------------------------------------
          When the pet has an Invoxia collar, surface Whereabouts + Activity
          from the cloud-synced invoxia.* tables.  When it doesn't, surface
          a single editorial upsell card — the app stays useful without the
          tracker, and the tracker becomes the obvious upgrade.            */}
      {id && <CloudTrackerSurface petId={id} petName={p.name} />}

      {/* BASICS CHART ---------------------------------------------- */}
      <Chart title="Basics" delay={40}>
        <Row label="Sex" value={SEX_LABEL[p.sex ?? "unknown"]} />
        <Row label="Neutered" value={NEUTERED_LABEL[p.neuteredStatus ?? "unknown"]} />
        <Row
          label="Date of birth"
          value={p.dob && p.dob !== new Date(0).toISOString()
            // Use UTC formatting — "2020-05-15" parses as UTC midnight, and a
            // locale-default toLocaleDateString in any TZ west of UTC would
            // show "May 14, 2020" for a North American owner. Pin to UTC so
            // the date the staff entered is the date the owner sees.
            ? new Date(p.dob).toLocaleDateString(undefined, {
                day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
              })
            : "—"}
        />
        <Row label="Weight" value={p.weightKg ? `${p.weightKg} kg` : "—"} />
        <Row label="Colour" value={p.colour || "—"} />
        <Row label="Microchip" value={p.microchip || "—"} />
      </Chart>

      {/* CARE CHART ------------------------------------------------- */}
      {(p.feedingInstructions || p.allergies) && (
        <Chart title="Care" delay={80}>
          {p.feedingInstructions && (
            <NarrativeRow
              icon={Heart}
              label="Feeding"
              value={p.feedingInstructions}
            />
          )}
          {p.allergies && (
            <NarrativeRow
              icon={AlertCircle}
              tone="warn"
              label="Allergies & sensitivities"
              value={p.allergies}
            />
          )}
        </Chart>
      )}

      {/* VET CHART ------------------------------------------------- */}
      {(p.vetName || p.vetPhone || p.vetAddress) && (
        <Chart title="Vet" delay={120}>
          {p.vetName && <Row label="Practice" value={p.vetName} />}
          {p.vetPhone && (
            <Row
              label="Phone"
              value={(
                <a href={`tel:${p.vetPhone}`} className="text-primary font-semibold text-tabular">
                  {p.vetPhone}
                </a>
              )}
              icon={Phone}
            />
          )}
          {p.vetAddress && (
            <NarrativeRow
              icon={MapPin}
              label="Address"
              value={p.vetAddress}
            />
          )}
        </Chart>
      )}

      {/* NOTES — two panes ----------------------------------------- */}
      {(hasOwnerNotes || hasTeamNotes) && (
        <section className="mb-6 anim-slide-up" style={{ animationDelay: "160ms" }}>
          <p className="text-eyebrow mb-2.5">Notes</p>
          {hasOwnerNotes && (
            <div className="rounded-2xl border border-primary/25 bg-secondary/40 p-4 mb-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-primary mb-1.5">From me</p>
              <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-line">
                {p.ownerNotes}
              </p>
            </div>
          )}
          {hasTeamNotes && (
            <div className="rounded-2xl border border-border bg-muted/60 p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">From the team</p>
              {p.teamBehaviourNotes && (
                <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-line">
                  {p.teamBehaviourNotes}
                </p>
              )}
              {p.teamMedicalNotes && (
                <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-line mt-2.5 pt-2.5 border-t border-border/60">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Medical</span>
                  {p.teamMedicalNotes}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* VACCINATIONS -------------------------------------------------- */}
      <section className="mb-2 anim-slide-up" style={{ animationDelay: "200ms" }}>
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-eyebrow">Vaccinations</h2>
          <Link
            to={`/pets/${id}/vax/upload`}
            className="press inline-flex items-center gap-1 h-8 px-3.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold hover:brightness-95"
          >
            <Plus size={13} strokeWidth={2.5} />
            Upload
          </Link>
        </header>
        {data.vaccinations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-7 text-center">
            <p className="text-[13px] text-muted-foreground">
              No vaccinations on file yet.{" "}
              <Link to={`/pets/${id}/vax/upload`} className="text-primary font-medium">
                Upload one
              </Link>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.vaccinations.map((v, i) => {
              const s = vaxStatus(v);
              return (
                <li key={v.id} className="anim-slide-up" style={{ animationDelay: `${240 + i * 50}ms` }}>
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{vaxTypeLabel(v.vaxType)}</p>
                      <p className="text-xs text-muted-foreground text-tabular mt-0.5">
                        Expires {new Date(v.expiresAt).toLocaleDateString(undefined, {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${VAX_STYLE[s]}`}>
                      {VAX_LABEL[s]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

// ---- chart atoms ------------------------------------------------------

function Chart({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <section
      className="rounded-2xl bg-card border border-border p-4 mb-3 anim-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-eyebrow mb-3">{title}</p>
      <dl className="divide-y divide-border/60 -mx-1">{children}</dl>
    </section>
  );
}

function Row({
  label, value, icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: typeof Phone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2.5">
      <dt className="text-[13px] text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon size={12} strokeWidth={2} className="opacity-70" />}
        {label}
      </dt>
      <dd className="text-[14px] font-medium text-foreground text-right truncate">{value}</dd>
    </div>
  );
}

function NarrativeRow({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string;
  icon: typeof Phone;
  tone?: "warn";
}) {
  return (
    <div className="px-1 py-2.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <Icon size={12} strokeWidth={2.4} className={tone === "warn" ? "text-destructive/80" : "opacity-70"} />
        {label}
      </dt>
      <dd className="text-[14px] leading-relaxed text-foreground whitespace-pre-line">{value}</dd>
    </div>
  );
}

/* ─── CLOUD TRACKER SURFACE ────────────────────────────────────────────
   Conditional wrapper: when a pet has a linked Invoxia device, show the
   Whereabouts + Activity cards; when it doesn't, show a single editorial
   upsell card.  Both branches share the same /whereabouts query cache so
   WhereaboutsCard doesn't re-fetch.
─────────────────────────────────────────────────────────────────────── */
function CloudTrackerSurface({ petId, petName }: { petId: string; petName: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePortalQuery<WhereaboutsResponse>(
    ["portal", "pets", petId, "whereabouts"],
    `/portal/pets/${petId}/whereabouts`,
    {
      enabled: !!petId,
      staleTime: 60_000,
      // CRITICAL: force a fresh fetch every time PetDetail mounts so a stale
      // error response (e.g. from a brief server outage) doesn't keep showing
      // the upsell card after the server recovers.
      refetchOnMount: "always",
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    },
  );

  if (isLoading) {
    return <div className="mb-3 h-44 rounded-[2rem] bg-card border border-border/60 animate-shimmer" />;
  }

  // Branch on error EXPLICITLY — an upstream failure must not silently morph
  // into "you don't have a tracker".  Show a retry surface instead so the
  // user can recover when the server comes back.
  if (isError) {
    return (
      <CardError
        title={`Couldn't reach ${petName}'s tracker right now`}
        body="The cloud sync is normally available; this is usually a brief blip. Tap to retry."
        retrying={isFetching}
        onRetry={() => refetch()}
        detail={error instanceof Error ? error.message : undefined}
      />
    );
  }

  // Genuinely no collar linked → editorial upsell.
  if (!data || data.coverage === "no_device") {
    return <TrackerUpsellCard petName={petName} petId={petId} />;
  }

  return (
    <>
      <WhereaboutsCard petId={petId} />
      <ActivityCard petId={petId} />
    </>
  );
}

/* Inline error card — never shown to "no tracker" users.  Has a retry CTA
   and an expandable detail so the user (or support) can see what failed. */
function CardError({
  title, body, retrying, onRetry, detail,
}: {
  title: string;
  body: string;
  retrying: boolean;
  onRetry: () => void;
  detail?: string;
}) {
  return (
    <section
      className="relative mb-3 overflow-hidden rounded-[2rem] bg-card border border-amber-200/60 anim-slide-up"
      style={{ boxShadow: "var(--shadow-card-soft)", animationDelay: "20ms" }}
    >
      <div className="relative p-6">
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 size-10 rounded-xl bg-amber-50 text-amber-700 grid place-items-center"
            aria-hidden="true"
          >
            <AlertCircle size={18} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
              Couldn't load
            </p>
            <p className="font-semibold text-[15px] leading-tight mt-1">{title}</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-2 max-w-[36ch]">
              {body}
            </p>
            <button
              onClick={onRetry}
              disabled={retrying}
              className="press mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-foreground text-background text-[13px] font-semibold disabled:opacity-60"
              style={{ boxShadow: "var(--shadow-card-soft)" }}
            >
              {retrying ? (
                <span className="inline-block size-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" aria-hidden="true" />
              ) : null}
              {retrying ? "Retrying…" : "Try again"}
            </button>
            {detail && (
              <details className="mt-3 text-[10px] text-muted-foreground">
                <summary className="cursor-pointer">Details</summary>
                <p className="mt-1 font-mono break-all">{detail}</p>
              </details>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── WHEREABOUTS CARD ─────────────────────────────────────────────────
   Cloud-derived GPS. Reads from invoxia.positions + invoxia.stays via
   /portal/pets/:id/whereabouts.  Renders the cold-start state cleanly,
   shows last-seen relative time with a status pill (live <60min vs stale),
   and a hairline-divided micro-stats row.  Tap to open the map screen.
─────────────────────────────────────────────────────────────────────── */
function WhereaboutsCard({ petId }: { petId: string }) {
  const { data, isLoading } = usePortalQuery<WhereaboutsResponse>(
    ["portal", "pets", petId, "whereabouts"],
    `/portal/pets/${petId}/whereabouts`,
    {
      enabled: !!petId,
      staleTime: 60_000,
      refetchOnMount: "always",
      retry: 3,
    },
  );

  if (isLoading) return <div className="mb-3 h-72 rounded-[2rem] bg-card border border-border/60 animate-shimmer" />;
  if (!data || data.coverage === "no_device" || !data.lastSeen) return null;

  const { lastSeen, positions, stays, deviceStatus } = data;
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(lastSeen.recorded_at).getTime()) / 60_000));
  const isStale = minutesAgo > 60;

  return (
    <Link
      to={`/pets/${petId}/whereabouts`}
      className="press group relative block mb-3 overflow-hidden rounded-[2rem] bg-card border border-border/60 anim-slide-up"
      style={{ boxShadow: "var(--shadow-diffusion)", animationDelay: "20ms" }}
      aria-label="Open whereabouts map"
    >
      {/* Embedded map preview — locked-down, decorative, taps pass through
          to the parent Link so the whole card opens the full map screen. */}
      <MiniMap
        lastSeen={lastSeen}
        positions={positions.slice(0, 80).map((p) => ({ lat: p.lat, lng: p.lng, ts: p.ts }))}
        heightPx={180}
      />

      {/* Status pill — floats over the top-right of the map */}
      <span
        className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10px] font-semibold tracking-wide backdrop-blur-md ${
          isStale
            ? "bg-amber-50/90 border-amber-200/80 text-amber-700"
            : "bg-emerald-50/90 border-emerald-200/80 text-emerald-700"
        }`}
      >
        <span
          className={`inline-block size-1.5 rounded-full animate-pulse-dot ${
            isStale ? "bg-amber-500" : "bg-emerald-500"
          }`}
          aria-hidden="true"
        />
        {isStale ? "Stale" : "Live"}
      </span>

      {/* Eyebrow — floats over the top-left */}
      <p className="absolute left-5 top-4 text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground bg-card/85 backdrop-blur-md rounded-full px-2.5 py-[3px]">
        Whereabouts
      </p>

      <div className="relative p-6">
        <div className="flex items-baseline gap-3">
          <Navigation size={20} strokeWidth={2} className="text-foreground/70 -mb-1" aria-hidden="true" />
          <span
            className="font-display text-tabular text-foreground leading-none"
            style={{ fontSize: 32, letterSpacing: "-0.025em" }}
          >
            {relativeAge(lastSeen.recorded_at)}
          </span>
          {deviceStatus && <BatteryChip status={deviceStatus} />}
        </div>
        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[34ch]">
          ±{lastSeen.accuracy_m} m via {deviceStatus?.network ?? "cellular"}. Tap to open the full map.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-4 pt-4 border-t border-border/60">
          <Stat label="Coords" mono>
            {lastSeen.lat.toFixed(4)}, {lastSeen.lng.toFixed(4)}
          </Stat>
          <Stat label="Pings 48h">{positions.length}</Stat>
          <Stat label="Places 7d">{stays.length}</Stat>
        </div>
      </div>
    </Link>
  );
}

/* Battery pill — small, semantic colour-coded by charge level. */
function BatteryChip({ status }: { status: DeviceStatus }) {
  const pct = status.battery_pct;
  if (pct == null) return null;

  let Icon: typeof BatteryFull;
  let tone: string;
  if (status.charging) {
    Icon = BatteryCharging;
    tone = "text-emerald-700 bg-emerald-50/80 border-emerald-200/70";
  } else if (pct <= 15 || status.lowBattery) {
    Icon = BatteryLow;
    tone = "text-rose-700 bg-rose-50/80 border-rose-200/70";
  } else if (pct <= 40) {
    Icon = BatteryMedium;
    tone = "text-amber-700 bg-amber-50/80 border-amber-200/70";
  } else {
    Icon = BatteryFull;
    tone = "text-emerald-700 bg-emerald-50/80 border-emerald-200/70";
  }

  return (
    <span
      className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-semibold tabular-nums tracking-wide ${tone}`}
      aria-label={`Collar battery ${pct}%${status.charging ? ", charging" : ""}`}
    >
      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      {pct}%
    </span>
  );
}

/* ─── ACTIVITY CARD ────────────────────────────────────────────────────
   Cloud-derived activity. Parses invoxia.life_reports for today's hours
   and health-session totals, plus the 14-day resting HR series from
   invoxia.daily_health.  Same "cloud-first, BLE-augments" story.
─────────────────────────────────────────────────────────────────────── */
function ActivityCard({ petId }: { petId: string }) {
  const { data, isLoading } = usePortalQuery<ActivityResponse>(
    ["portal", "pets", petId, "activity"],
    `/portal/pets/${petId}/activity`,
    {
      enabled: !!petId,
      staleTime: 60_000,
      refetchOnMount: "always",
      retry: 3,
    },
  );

  if (isLoading) return <div className="mb-6 h-44 rounded-[2rem] bg-card border border-border/60 animate-shimmer" />;
  if (!data) return null;

  const today  = data.today;
  const hr     = data.hrSeries.map((h) => h.hr_avg);
  const hasHr  = hr.length >= 2;
  const latestReport = data.reports[0]?.msg ? stripEmoji(data.reports[0].msg) : null;

  return (
    <section
      className="relative mb-6 overflow-hidden rounded-[2rem] bg-card border border-border/60 anim-slide-up"
      style={{ boxShadow: "var(--shadow-diffusion)", animationDelay: "60ms" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--secondary) 60%, transparent) 0%, transparent 55%)",
        }}
      />
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
            Activity — Today
          </p>
          {data.lastActivity && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground tracking-wide">
              <Clock size={11} strokeWidth={2.2} aria-hidden="true" />
              {relativeAge(data.lastActivity)}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className="font-display text-tabular text-foreground leading-none"
            style={{ fontSize: 56, letterSpacing: "-0.03em" }}
          >
            {today?.activeHours != null ? today.activeHours : "—"}
          </span>
          <span className="text-sm font-medium text-muted-foreground -mb-1 tracking-wide">
            {today?.activeHours != null
              ? (today.activeHours === 1 ? "hour active" : "hours active")
              : "no report yet"}
          </span>
        </div>

        {today?.sessions && (
          <p className="text-[13px] text-muted-foreground mt-2">
            <span className="text-foreground font-semibold tabular-nums">{today.sessions.count}</span>
            {" "}health session{today.sessions.count === 1 ? "" : "s"} ·
            {" "}<span className="text-foreground font-semibold tabular-nums">{today.sessions.minutes}</span> min total
          </p>
        )}

        {latestReport && (
          <p className="mt-3 text-[13px] text-foreground/80 leading-relaxed max-w-[40ch]">
            {latestReport}
          </p>
        )}

        {hasHr && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] uppercase tracking-[0.20em] font-semibold text-muted-foreground">
                Resting HR · {hr.length} d
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                avg {Math.round(hr.reduce((a, b) => a + b, 0) / hr.length)} bpm
              </p>
            </div>
            <Sparkline values={hr} width={320} height={42} color="rgb(220 38 67)" fillOpacity={0.08} showDot />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label, children, mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[9px] uppercase tracking-[0.20em] font-semibold text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-[13px] text-foreground leading-tight truncate ${
          mono ? "font-mono tabular-nums" : "font-semibold tabular-nums"
        }`}
      >
        {children}
      </span>
    </div>
  );
}
