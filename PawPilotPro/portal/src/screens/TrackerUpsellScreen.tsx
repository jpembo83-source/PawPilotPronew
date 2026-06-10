/**
 * Tracker upsell — the full-screen explainer.
 *
 * Editorial product page positioning the PawPilot Tracker (an Invoxia LWT6
 * collar in OEM clothing) as the upgrade from the basic daycare app to a
 * connected health platform.  Reached from PetDetail's upsell card and from
 * the Pulse screen's empty state.
 *
 * No real purchase flow yet — the CTA captures a "Notify me when available"
 * intent and lets the team follow up.  When a real Stripe / Shop integration
 * lands, this file is the single point of change.
 */
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, Heart, Wind, Navigation, Activity, Moon, Mail, Check,
  Bluetooth, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export function TrackerUpsellScreen() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const fromPet = params.get("from");
  const [submitted, setSubmitted] = useState(false);

  function handleNotify() {
    // For build 23 we just toast a confirmation — there's no commerce surface
    // yet.  Replace with a server endpoint that pushes the lead to staff /
    // CRM when the real purchase flow ships.
    setSubmitted(true);
    toast.success("Thanks — we'll be in touch.", {
      description: `We've noted ${session?.user?.email ?? "your account"} for the next batch.`,
    });
  }

  return (
    <main className="px-5 pt-8 pb-12 max-w-md mx-auto">
      <button
        onClick={() => (fromPet ? navigate(`/pets/${fromPet}`) : navigate(-1))}
        className="press inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
        Back
      </button>

      {/* HERO ----------------------------------------------------------- */}
      <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
        PawPilot Tracker
      </p>
      <h1
        className="font-display leading-[0.92] tracking-[-0.022em] mt-2 mb-4 text-foreground"
        style={{ fontSize: "clamp(40px, 11vw, 56px)" }}
      >
        The dog<br /><em className="not-italic font-display" style={{ fontStyle: "italic" }}>knows.</em><br />Now you do too.
      </h1>
      <p className="text-[15px] text-muted-foreground mb-7 max-w-[36ch] leading-relaxed">
        A featherweight collar attachment that streams heart rate, breath rate, sleep, activity and location to your phone — all day, every day.
      </p>

      {/* ABSTRACT PRODUCT HERO -----------------------------------------
          Composed in CSS — a soft-tinted card, a centred circular silhouette
          standing in for the collar, and a rose ECG line tracing across.
          Replace with real product photography when we have it. */}
      <section
        className="relative mb-8 overflow-hidden rounded-[2rem] border border-border/60 anim-fade-in"
        style={{
          boxShadow: "var(--shadow-diffusion)",
          background:
            "radial-gradient(140% 100% at 50% 110%, color-mix(in srgb, var(--secondary) 90%, transparent) 0%, var(--card) 60%)",
        }}
      >
        <div className="relative aspect-[5/4] grid place-items-center">
          {/* concentric breathing rings — the collar silhouette */}
          <span className="absolute size-44 rounded-full border border-foreground/12" aria-hidden="true" />
          <span className="absolute size-36 rounded-full border border-foreground/20" aria-hidden="true" />
          <span
            className="absolute size-28 rounded-full bg-gradient-to-br from-foreground/85 to-foreground"
            aria-hidden="true"
            style={{ boxShadow: "var(--shadow-diffusion)" }}
          />
          <span
            className="absolute size-28 rounded-full grid place-items-center text-background"
            aria-hidden="true"
          >
            <Heart size={36} strokeWidth={1.4} fill="currentColor" className="animate-breathe" />
          </span>

          {/* ECG line cutting across */}
          <svg
            className="absolute inset-x-0 bottom-10 w-full pointer-events-none"
            height="60" viewBox="0 0 380 60" preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,30 L80,30 L92,30 L100,10 L112,50 L122,4 L132,56 L144,30 L240,30 L252,30 L260,18 L272,42 L282,30 L380,30"
              stroke="rgb(220 38 67)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 6"
              className="animate-drift-dash opacity-80"
            />
          </svg>
        </div>
        <p className="absolute left-5 top-5 text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
          Sketch
        </p>
        <p className="absolute right-5 top-5 text-[10px] tracking-wide text-muted-foreground tabular-nums">
          14 g · LTE-M · BLE
        </p>
      </section>

      {/* WHAT YOU GET --------------------------------------------------- */}
      <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground mb-3">
        What you get
      </p>
      <ul className="space-y-2.5 mb-8">
        <FeatureRow
          icon={Heart}
          title="Resting heart rate"
          body="Daily readings during sleep — the most reliable early-warning signal vets look at."
        />
        <FeatureRow
          icon={Wind}
          title="Breath rate & HRV"
          body="Sub-clinical respiratory and recovery markers, summarised in plain English."
        />
        <FeatureRow
          icon={Activity}
          title="Activity totals"
          body="Hours moving vs. resting, broken down per day. See the impact of new routines."
        />
        <FeatureRow
          icon={Moon}
          title="Sleep quality"
          body="Continuous overnight monitoring — fragmented sleep is the first thing to change."
        />
        <FeatureRow
          icon={Navigation}
          title="Cellular location"
          body="Every five minutes via LTE-M, even when you're at the office. No phone required."
        />
      </ul>

      {/* HOW IT FITS ---------------------------------------------------- */}
      <section
        className="rounded-[2rem] bg-foreground text-background p-6 mb-8 relative overflow-hidden"
        style={{ boxShadow: "var(--shadow-diffusion)" }}
      >
        <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-background/55">
          Two channels, one story
        </p>
        <h2 className="font-display text-background leading-tight mt-2 mb-4" style={{ fontSize: 22 }}>
          Cellular sync. Bluetooth augment.
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <DualChannel
            icon={Wifi}
            label="Cellular"
            body="Every 5 minutes to the cloud — works on its own."
          />
          <DualChannel
            icon={Bluetooth}
            label="Bluetooth"
            body="When your phone's nearby — sub-minute streaming."
          />
        </div>
      </section>

      {/* CTA ------------------------------------------------------------ */}
      {!submitted ? (
        <button
          onClick={handleNotify}
          className="press group relative inline-flex items-center justify-center gap-2.5 w-full h-14 rounded-[1.25rem] bg-foreground text-background font-semibold transition-opacity hover:opacity-[0.96]"
          style={{ boxShadow: "var(--shadow-card-soft)" }}
        >
          <Mail size={17} strokeWidth={2.4} aria-hidden="true" />
          <span className="tracking-[-0.005em] text-[15px]">Notify me when it's available</span>
        </button>
      ) : (
        <div
          className="inline-flex items-center justify-center gap-2.5 w-full h-14 rounded-[1.25rem] bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200"
          role="status"
        >
          <Check size={17} strokeWidth={2.6} aria-hidden="true" />
          You're on the list
        </div>
      )}

      <p className="mt-3 text-center text-[12px] text-muted-foreground leading-relaxed max-w-[40ch] mx-auto">
        We'll email you the moment the next batch is available through your daycare. No commitment.
      </p>

      <div className="mt-10 pt-6 border-t border-border/60 text-center">
        <p className="text-[10px] tracking-[0.24em] uppercase font-medium text-muted-foreground mb-1">
          Or
        </p>
        <Link
          to={fromPet ? `/pets/${fromPet}` : "/pets"}
          className="text-sm font-medium text-primary"
        >
          Keep using the app without it
        </Link>
        <p className="mt-2 text-[12px] text-muted-foreground max-w-[34ch] mx-auto leading-relaxed">
          Bookings, vaccinations, vet share, household — all work fully without the tracker.
        </p>
      </div>
    </main>
  );
}

function FeatureRow({
  icon: Icon, title, body,
}: {
  icon: typeof Heart;
  title: string;
  body: string;
}) {
  return (
    <li
      className="flex items-start gap-3.5 rounded-2xl bg-card border border-border/60 p-4"
      style={{ boxShadow: "var(--shadow-card-soft)" }}
    >
      <div className="size-10 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
        <Icon size={17} strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="font-semibold text-[14px] leading-tight">{title}</p>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1">{body}</p>
      </div>
    </li>
  );
}

function DualChannel({
  icon: Icon, label, body,
}: {
  icon: typeof Wifi;
  label: string;
  body: string;
}) {
  return (
    <div>
      <Icon size={16} strokeWidth={2} className="text-background/70 mb-2" aria-hidden="true" />
      <p className="font-display text-background text-base leading-tight">{label}</p>
      <p className="text-[12px] text-background/65 leading-relaxed mt-1">{body}</p>
    </div>
  );
}
