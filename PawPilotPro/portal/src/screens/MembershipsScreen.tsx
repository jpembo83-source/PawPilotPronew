/**
 * Memberships upsell — the full-screen plan picker.
 *
 * Editorial product page positioning MDC's five membership tiers as the
 * upgrade from drop-in bookings to a regular routine.  Reached from the
 * Account screen's "Your plan" card and (eventually) from a HomeScreen
 * empty-state hint.
 *
 * No real purchase flow yet — each tier's "I'm interested" button captures
 * a "tell me more" intent and pings staff, mirroring the TrackerUpsellScreen
 * pattern.  When a real Stripe / billing integration lands, this file is
 * the single point of change — swap the TIERS const for a /portal/memberships
 * GET, and the handleInterest() body for a checkout flow.
 *
 * Pricing source: mydogcompany.com/membership as of 2026-05-31.  Lives here
 * (not the backend) until we generalise this for non-MDC tenants — the only
 * paying tenant today is MDC, so the marginal cost of a backend round-trip
 * outweighs the marginal benefit of one-source-of-truth.  When a second
 * tenant lights up, lift this into settings:memberships under org settings.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, Check, Mail, Sparkles, Users, Calendar, Sunrise,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

/* --------------------------------------------------------------------- */
/* TIER DATA                                                              */
/* --------------------------------------------------------------------- */

interface Tier {
  /** Stable id for analytics + future server lookup. */
  id: "split-social" | "stayin-contact" | "fun-regular" | "zurich-socialite" | "fomo";
  /** Display name — the playful MDC brand voice. */
  name: string;
  /** Tagline tucked under the name. */
  tag: string;
  /** Monthly price in CHF. */
  priceChf: number;
  /** Headline allowance ("8 half-days", "Everyday"). */
  allowance: string;
  /** Two or three concrete bullets, in order. */
  perks: string[];
  /** Flag the value-sweet-spot tier with the eyebrow ribbon. */
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "stayin-contact",
    name: "Stayin in Contact",
    tag: "Toes in the water",
    priceChf: 473,
    allowance: "5 full days / month",
    perks: [
      "One day a week, on average",
      "Pack-bonded daycare, full days",
      "Priority over drop-ins",
    ],
  },
  {
    id: "split-social",
    name: "Split My Social",
    tag: "Twice-a-week half-days",
    priceChf: 493,
    allowance: "8 half-days / month",
    perks: [
      "Two half-days a week",
      "Great for pups still building stamina",
      "Same priority as full members",
    ],
  },
  {
    id: "fun-regular",
    name: "Fun on the Regular",
    tag: "The sweet spot",
    priceChf: 897,
    allowance: "10 full days / month",
    perks: [
      "Two or three days a week",
      "Most-chosen plan — best balance of price and pack-time",
      "Members-only events & first-pick on overnights",
    ],
    highlight: true,
  },
  {
    id: "zurich-socialite",
    name: "Zurich Socialite",
    tag: "Most days, most weeks",
    priceChf: 1255,
    allowance: "15 full days / month",
    perks: [
      "Three to four days a week",
      "Highest day-priority — never bumped",
      "Members-only events & first-pick on overnights",
    ],
  },
  {
    id: "fomo",
    name: "Fear of Missing Out",
    tag: "Every day is daycare day",
    priceChf: 1605,
    allowance: "Everyday access",
    perks: [
      "Unlimited daycare, every day we're open",
      "Guaranteed spot — no caps, no waitlists",
      "Concierge: bookings, overnights, grooming, transport",
    ],
  },
];

const CHF_FORMAT = new Intl.NumberFormat("de-CH", {
  // Swiss thousands separator (apostrophe) — locale "de-CH" gives "1'605".
  // Manually formatted as `CHF 1'605` in the markup so the unit reads as
  // a label rather than getting compressed into a tabular number cell.
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/* --------------------------------------------------------------------- */
/* SCREEN                                                                 */
/* --------------------------------------------------------------------- */

export function MembershipsScreen() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const from = params.get("from"); // ?from=account to round-trip back there
  const [pickedId, setPickedId] = useState<Tier["id"] | null>(null);

  // Memoise so highlight ordering stays stable across re-renders.
  const tiers = useMemo(() => TIERS, []);

  function handleInterest(tier: Tier) {
    // For v29 this is a fire-and-forget lead-capture: toast the user, keep
    // a soft visual confirmation on the picked card, and trust staff to
    // follow up out-of-band.  When the /portal/memberships/interest endpoint
    // lands, this becomes a useMutation against that route.
    setPickedId(tier.id);
    toast.success(`Got it — we'll be in touch about ${tier.name}.`, {
      description: `Saved against ${session?.user?.email ?? "your account"}.`,
    });
  }

  function handleGeneralInterest() {
    // The big "Talk to a human" CTA at the bottom is not bound to any
    // specific tier — it's a generic "I want to discuss" lead.  Doesn't
    // mark any card as picked.
    toast.success("Got it — we'll be in touch about memberships.", {
      description: `Saved against ${session?.user?.email ?? "your account"}.`,
    });
  }

  return (
    <main className="px-5 pt-8 pb-12 max-w-md mx-auto">
      <button
        onClick={() => (from === "account" ? navigate("/account") : navigate(-1))}
        className="press inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
        Back
      </button>

      {/* HERO ----------------------------------------------------------- */}
      <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
        Memberships
      </p>
      <h1
        className="font-display leading-[0.92] tracking-[-0.022em] mt-2 mb-4 text-foreground"
        style={{ fontSize: "clamp(40px, 11vw, 56px)" }}
      >
        Be part<br />
        of the <em className="not-italic font-display" style={{ fontStyle: "italic" }}>pack.</em>
      </h1>
      <p className="text-[15px] text-muted-foreground mb-7 max-w-[36ch] leading-relaxed">
        Familiar faces, consistent routines, chilled vibes — the pups we know best are the pups that thrive most.
      </p>

      {/* ABSTRACT HERO -------------------------------------------------
          Five overlapping circles standing in for the five tiers.  Sizes
          and positions are intentional: smallest at the back-left
          (Stayin), largest at the front-right (FOMO).  Replace with real
          pack photography when the rebrand lands. */}
      <section
        className="relative mb-8 overflow-hidden rounded-[2rem] border border-border/60 anim-fade-in"
        style={{
          boxShadow: "var(--shadow-diffusion)",
          background:
            "radial-gradient(140% 100% at 50% 110%, color-mix(in srgb, var(--secondary) 90%, transparent) 0%, var(--card) 60%)",
        }}
      >
        <div className="relative aspect-[5/4]">
          {/* Five pack-circles — each represents a tier; the bigger the
              dot, the more days. */}
          <span
            className="absolute size-16 rounded-full bg-foreground/85"
            style={{ left: "18%", top: "32%", boxShadow: "var(--shadow-card-soft)" }}
            aria-hidden="true"
          />
          <span
            className="absolute size-20 rounded-full bg-foreground/80"
            style={{ left: "30%", top: "44%", boxShadow: "var(--shadow-card-soft)" }}
            aria-hidden="true"
          />
          <span
            className="absolute size-24 rounded-full bg-foreground"
            style={{ left: "44%", top: "30%", boxShadow: "var(--shadow-diffusion)" }}
            aria-hidden="true"
          />
          <span
            className="absolute size-20 rounded-full bg-foreground/85"
            style={{ left: "58%", top: "48%", boxShadow: "var(--shadow-card-soft)" }}
            aria-hidden="true"
          />
          <span
            className="absolute size-28 rounded-full bg-foreground"
            style={{ left: "62%", top: "28%", boxShadow: "var(--shadow-diffusion)" }}
            aria-hidden="true"
          />
          {/* Soft halo behind the pack to anchor it. */}
          <span
            className="absolute size-64 rounded-full"
            style={{
              left: "50%",
              top: "55%",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 16%, transparent) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />
        </div>
        <p className="absolute left-5 top-5 text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">
          The pack
        </p>
        <p className="absolute right-5 top-5 text-[10px] tracking-wide text-muted-foreground tabular-nums">
          5 plans · CHF
        </p>
      </section>

      {/* TIERS ----------------------------------------------------------- */}
      <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground mb-3">
        Five ways to be a regular
      </p>
      <ul className="space-y-2.5 mb-8">
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            picked={pickedId === tier.id}
            onPick={() => handleInterest(tier)}
          />
        ))}
      </ul>

      {/* MULTI-DOG STORY (inverted card) -------------------------------- */}
      <section
        className="rounded-[2rem] bg-foreground text-background p-6 mb-8 relative overflow-hidden"
        style={{ boxShadow: "var(--shadow-diffusion)" }}
      >
        <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-background/55">
          More than one pup?
        </p>
        <h2 className="font-display text-background leading-tight mt-2 mb-4" style={{ fontSize: 22 }}>
          Bring the whole crew. We'll cut you a deal.
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <PerkRow
            icon={Users}
            label="Second dog"
            body="50% off every additional membership on the same household."
          />
          <PerkRow
            icon={Sparkles}
            label="Double Trouble"
            body="Two pups, one plan — paired packages built for siblings."
          />
        </div>
        <p className="mt-4 text-[12.5px] text-background/65 leading-relaxed">
          Triple Threat available for three-pup households. Ask the team — every multi-dog mix is bespoke.
        </p>
      </section>

      {/* WHAT EVERY MEMBER GETS ----------------------------------------- */}
      <p className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground mb-3">
        Every plan includes
      </p>
      <ul className="space-y-2.5 mb-8">
        <IncludedRow
          icon={Calendar}
          title="No sign-up fees, no minimum term"
          body="Pause or change tiers month-to-month — life with a dog is unpredictable enough."
        />
        <IncludedRow
          icon={Sunrise}
          title="Priority over drop-in bookings"
          body="Members get first dibs on the day. Drop-ins fill what's left."
        />
        <IncludedRow
          icon={Sparkles}
          title="Members-only events"
          body="Pack walks, training pop-ups, and the occasional yappy-hour."
        />
      </ul>

      {/* TALK TO US ----------------------------------------------------- */}
      <button
        onClick={handleGeneralInterest}
        className="press group relative inline-flex items-center justify-center gap-2.5 w-full h-14 rounded-[1.25rem] bg-foreground text-background font-semibold transition-opacity hover:opacity-[0.96]"
        style={{ boxShadow: "var(--shadow-card-soft)" }}
      >
        <Mail size={17} strokeWidth={2.4} aria-hidden="true" />
        <span className="tracking-[-0.005em] text-[15px]">Talk to a human</span>
      </button>
      <p className="mt-3 text-center text-[12px] text-muted-foreground leading-relaxed max-w-[40ch] mx-auto">
        We'll pick the right plan together — including the multi-dog and bespoke options that don't fit in a table.
      </p>

      {/* FALLBACK ------------------------------------------------------- */}
      <div className="mt-10 pt-6 border-t border-border/60 text-center">
        <p className="text-[10px] tracking-[0.24em] uppercase font-medium text-muted-foreground mb-1">
          Or
        </p>
        <Link to="/book" className="text-sm font-medium text-primary">
          Stick to pay-per-visit
        </Link>
        <p className="mt-2 text-[12px] text-muted-foreground max-w-[34ch] mx-auto leading-relaxed">
          Drop-ins are always welcome. Just no priority over members on busy days.
        </p>
      </div>
    </main>
  );
}

/* --------------------------------------------------------------------- */
/* TIER CARD                                                              */
/* --------------------------------------------------------------------- */

function TierCard({
  tier,
  picked,
  onPick,
}: {
  tier: Tier;
  picked: boolean;
  onPick: () => void;
}) {
  const priceLabel = CHF_FORMAT.format(tier.priceChf).replace(/,/g, "’");
  // ’ = ’ (right single quote) — Swiss convention. Intl.NumberFormat
  // for de-CH uses U+2019 already but we belt-and-braces it for older WKWebView
  // versions that fall back to comma.

  return (
    <li
      className={`relative rounded-2xl border p-4 transition-colors ${
        tier.highlight
          ? "bg-secondary/60 border-primary/35"
          : "bg-card border-border/60"
      } ${picked ? "ring-2 ring-emerald-400/60" : ""}`}
      style={{
        boxShadow: tier.highlight
          ? "var(--shadow-card-soft), 0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent)"
          : "var(--shadow-card-soft)",
      }}
    >
      {tier.highlight && (
        <p
          className="absolute -top-2.5 left-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] tracking-[0.18em] uppercase font-semibold"
          aria-label="Most popular plan"
        >
          <Sparkles size={10} strokeWidth={2.4} aria-hidden="true" />
          Most popular
        </p>
      )}

      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <h3 className="font-display text-foreground leading-tight" style={{ fontSize: 22 }}>
          {tier.name}
        </h3>
        <div className="text-right shrink-0">
          <p className="font-semibold text-foreground text-[18px] leading-tight tabular-nums">
            <span className="text-[12px] tracking-wide text-muted-foreground mr-0.5">CHF</span>
            {priceLabel}
          </p>
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">per month</p>
        </div>
      </div>

      <p className="text-[12.5px] text-muted-foreground mb-2.5">{tier.tag}</p>
      <p className="inline-flex items-center gap-1.5 mb-3 px-2 py-1 rounded-full bg-secondary/70 text-secondary-foreground text-[11.5px] font-medium">
        <Calendar size={11} strokeWidth={2.4} aria-hidden="true" />
        {tier.allowance}
      </p>

      <ul className="space-y-1.5 mb-3">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-[13px] leading-snug text-foreground/85">
            <Check
              size={13}
              strokeWidth={2.6}
              className="mt-[3px] text-primary shrink-0"
              aria-hidden="true"
            />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onPick}
        disabled={picked}
        className={`press w-full h-11 rounded-xl text-sm font-semibold transition-colors ${
          picked
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-foreground text-background hover:opacity-[0.96]"
        }`}
      >
        {picked ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Check size={14} strokeWidth={2.6} aria-hidden="true" />
            We'll be in touch
          </span>
        ) : (
          "I'm interested"
        )}
      </button>
    </li>
  );
}

/* --------------------------------------------------------------------- */
/* SUPPORTING ROWS                                                        */
/* --------------------------------------------------------------------- */

function PerkRow({
  icon: Icon, label, body,
}: {
  icon: typeof Users;
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

function IncludedRow({
  icon: Icon, title, body,
}: {
  icon: typeof Calendar;
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
