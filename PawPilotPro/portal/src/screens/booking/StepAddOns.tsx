import { Check, Car, Scissors, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { getPortalApi } from "@/lib/api";
import type { Quote, QuoteService } from "@shared/types/quote";

/**
 * Cross-sell step — shown after StepDates ONLY when the primary service
 * supports add-ons (daycare or overnights). For grooming + transport
 * primaries, BookingFlow skips this step entirely.
 *
 * Owner-side rules:
 *   - Daycare    → can add Transport (pickup + drop-off, same window)
 *                  and Grooming (same-day, same window)
 *   - Overnights → can add Transport
 *
 * Both are off-by-default — picked add-ons turn the request into a
 * bundle that staff approves atomically (whole thing or nothing).
 * Owner can always skip.
 *
 * Pricing surface (Phase F): each offered add-on shows an estimated
 * price next to its tickedDetail line. The estimate is a single-item
 * quote fetched once per offered service when this step mounts (or
 * when the primary window / pets change) — we deliberately do NOT
 * re-quote on toggle, because the price doesn't depend on whether the
 * owner has it checked. Loading and error states fall through silently
 * so the card never blocks or breaks the page.
 */
export function StepAddOns({ onNext }: { onNext: () => void }) {
  const { service, addOns, setAddOn, startAt, endAt, petIds } = useBookingDraftStore();

  const offerGrooming = service === "daycare";
  const offerTransport = service === "daycare" || service === "overnights";

  // Single-line quote per offered add-on. Same window + pets as the
  // primary — staff will reconcile real pricing on approval.
  const transportQuote = useAddOnQuote("transport", offerTransport, petIds, startAt, endAt);
  const groomingQuote = useAddOnQuote("grooming", offerGrooming, petIds, startAt, endAt);

  // Friendly description of the times we'll inherit from the primary.
  const window = startAt && endAt ? formatWindow(startAt, endAt) : null;
  const dropTime = startAt ? new Date(startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const pickupTime = endAt ? new Date(endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const transportBase = window
    ? `Pickup ${dropTime} · drop-off ${pickupTime}`
    : "Same times as the main booking";
  const groomingBase = window ? "Slotted into the daycare visit" : "Same day as daycare";

  return (
    <>
      <header className="mb-6 anim-fade-in">
        <p className="text-eyebrow mb-2">Step 4</p>
        <h1 className="text-display-sm mb-1.5">Anything to add?</h1>
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          Easy to bundle a few things into one visit — pick what you need or skip ahead.
        </p>
      </header>

      <ul className="space-y-2.5 mb-6">
        {offerTransport && (
          <li className="anim-slide-up">
            <AddOnCard
              icon={Car}
              title="Pickup & drop-off"
              tagline="Our van collects them and brings them home."
              tickedDetail={withEstimate(transportBase, transportQuote.data)}
              active={addOns.transport === "on"}
              onToggle={() => setAddOn("transport", addOns.transport === "on" ? "off" : "on")}
            />
          </li>
        )}
        {offerGrooming && (
          <li className="anim-slide-up" style={{ animationDelay: "60ms" }}>
            <AddOnCard
              icon={Scissors}
              title="Same-day groom"
              tagline="Tidy them up while they're here — bath, brush, and tidy."
              tickedDetail={withEstimate(groomingBase, groomingQuote.data)}
              active={addOns.grooming === "on"}
              onToggle={() => setAddOn("grooming", addOns.grooming === "on" ? "off" : "on")}
            />
          </li>
        )}
      </ul>

      {(addOns.transport === "on" || addOns.grooming === "on") && (
        <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground leading-relaxed mb-6 anim-fade-in">
          <Sparkles size={13} strokeWidth={2} className="shrink-0 mt-0.5 text-primary" />
          The team will approve the whole bundle together — one yes, one no.
        </p>
      )}

      <button
        onClick={onNext}
        className="press group relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] overflow-hidden"
      >
        <span className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none" aria-hidden="true" />
        <span className="tracking-[-0.005em]">Continue</span>
      </button>
    </>
  );
}

function AddOnCard({
  icon: Icon, title, tagline, tickedDetail, active, onToggle,
}: {
  icon: typeof Car;
  title: string;
  tagline: string;
  tickedDetail: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`press w-full p-4 rounded-2xl border bg-card flex items-start gap-3.5 text-left hover:shadow-[var(--shadow-md)] transition-shadow ${
        active
          ? "border-primary ring-2 ring-primary/15 shadow-[var(--shadow-sm)] bg-secondary/30"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div
        className={`size-11 rounded-xl grid place-items-center shrink-0 transition-colors ${
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        }`}
      >
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[15px] leading-tight">{title}</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{tagline}</p>
        {/* Show the detail line (window + price estimate) BEFORE the toggle —
            the price is what informs the decision, so hiding it until the
            user has already committed defeats the point. Tone shifts to
            primary + fade-in once selected so the affirmation cue stays. */}
        {tickedDetail && (
          <p className={`text-[12px] font-medium mt-1.5 text-tabular ${
            active ? "text-primary anim-fade-in" : "text-muted-foreground"
          }`}>
            {tickedDetail}
          </p>
        )}
      </div>
      <div
        className={`size-6 rounded-full grid place-items-center shrink-0 mt-0.5 transition-colors ${
          active ? "bg-primary text-primary-foreground" : "border border-border"
        }`}
        aria-hidden="true"
      >
        {active && <Check size={14} strokeWidth={3} />}
      </div>
    </button>
  );
}

function formatWindow(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const t = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${t(s)} – ${t(e)}`;
}

/**
 * Fetch a single-line quote for one add-on service. Gated on the primary
 * window + pets being set so we don't fire while the draft is still
 * incomplete. `enabled` also covers the "is this add-on offered for the
 * current primary?" check — when false we never spend the network call.
 *
 * Errors are swallowed by react-query into `.error`; the caller treats
 * `data === undefined` (loading OR error) the same way: no suffix.
 */
function useAddOnQuote(
  addOn: QuoteService,
  enabled: boolean,
  petIds: string[],
  startAt: string | null,
  endAt: string | null,
) {
  const ready = enabled && petIds.length > 0 && !!startAt && !!endAt;
  return useQuery<Quote>({
    queryKey: ["portal", "quote", "addon", addOn, startAt, endAt, petIds.join(",")],
    queryFn: () =>
      getPortalApi().post<Quote>("/portal/quote", {
        items: [
          {
            service: addOn,
            petIds,
            startAt,
            endAt,
          },
        ],
      }),
    enabled: ready,
    // The quote is a 15-minute snapshot staff-side; mirror that here so
    // bouncing back to this step within the wizard doesn't re-fire.
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Append "· ~CHF 18.50" to the tickedDetail line when a quote is in.
 * The "~" marker is intentional — it's the visual cue that this is an
 * Estimate and not a binding price. Currency comes from the quote
 * payload, not a hardcoded constant.
 *
 * If the quote hasn't landed (loading) or errored, we return the base
 * detail unchanged so the card never blocks or shows a broken state.
 */
function withEstimate(base: string, quote: Quote | undefined): string {
  if (!quote || quote.lineItems.length === 0) return base;
  const total = quote.lineItems[0]!.total;
  if (!Number.isFinite(total) || total <= 0) return base;
  return `${base} · ~${quote.currency} ${total.toFixed(2)}`;
}
