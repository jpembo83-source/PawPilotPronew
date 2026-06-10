/**
 * Tracker upsell card — shown in place of the Whereabouts + Activity cards
 * on PetDetail (and in place of the Pulse hero) when a pet has no Invoxia
 * collar linked.  Editorial, not nag-y.
 *
 * The card is a Link to /tracker/upsell which is the full-screen explainer
 * + purchase / "notify me" surface.
 */
import { Link } from "react-router-dom";
import { Heart, Wind, Navigation, Sparkles, ArrowUpRight } from "lucide-react";

interface TrackerUpsellCardProps {
  petName: string;
  /** the pet whose detail the card is being shown on — used for deep-link */
  petId: string;
  /** smaller variant for embedding in tighter surfaces */
  compact?: boolean;
}

export function TrackerUpsellCard({ petName, petId, compact = false }: TrackerUpsellCardProps) {
  return (
    <Link
      to={`/tracker/upsell?from=${petId}`}
      className="press group relative block mb-6 overflow-hidden rounded-[2rem] bg-card border border-border/60 anim-slide-up"
      style={{ boxShadow: "var(--shadow-diffusion)", animationDelay: "20ms" }}
      aria-label={`Add a PawPilot Tracker for ${petName}`}
    >
      {/* Soft brand-tinted radial backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--secondary) 80%, transparent) 0%, transparent 60%)",
        }}
      />
      {/* Subtle ECG trace decoration that drifts behind the headline */}
      <svg
        className="pointer-events-none absolute right-0 top-3 opacity-[0.08]"
        width="220" height="50" viewBox="0 0 220 50" fill="none" aria-hidden="true"
      >
        <path
          d="M0,25 L40,25 L48,25 L56,10 L66,40 L74,4 L82,46 L92,25 L120,25 L130,25 L138,15 L146,38 L154,25 L220,25"
          stroke="rgb(220 38 67)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 5"
          className="animate-drift-dash"
        />
      </svg>

      <div className={compact ? "relative p-5" : "relative p-6"}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
            Tracker · Recommended
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-[3px] text-[10px] font-medium tracking-wide text-muted-foreground bg-background/40 backdrop-blur-sm">
            <Sparkles size={10} strokeWidth={2.4} aria-hidden="true" />
            Add
          </span>
        </div>

        <h3
          className="font-display text-foreground leading-[1.05] tracking-[-0.025em]"
          style={{ fontSize: compact ? 24 : 28 }}
        >
          See {petName}'s heart, every day.
        </h3>
        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[36ch]">
          The PawPilot Tracker reports heart rate, breath rate, sleep, activity and location every five minutes — even when you're at work.
        </p>

        <div className="mt-5 flex items-end justify-between gap-3 pt-4 border-t border-border/60">
          <FeatureMark icon={Heart}      label="Heart" />
          <FeatureMark icon={Wind}       label="Breath" />
          <FeatureMark icon={Navigation} label="Location" />
          <FeatureMark icon={Sparkles}   label="Sleep" />
          <ArrowUpRight
            size={18} strokeWidth={2.2}
            className="mb-1 text-muted-foreground/70 group-hover:text-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 shrink-0"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}

function FeatureMark({ icon: Icon, label }: { icon: typeof Heart; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <Icon size={16} strokeWidth={1.8} className="text-foreground/75" aria-hidden="true" />
      <span className="text-[9px] uppercase tracking-[0.18em] font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
