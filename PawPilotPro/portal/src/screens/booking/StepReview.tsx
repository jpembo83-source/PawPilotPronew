import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Scissors, Sun, Moon, Info } from "lucide-react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { getPortalApi } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import type { Service } from "@shared/types/booking";
import type { Quote, QuoteRequest, QuoteService } from "@shared/types/quote";

const SERVICE_LABEL: Record<string, string> = {
  daycare: "Daycare",
  grooming: "Grooming",
  overnights: "Overnights",
  transport: "Transport",
};

const SERVICE_ICON: Record<string, typeof Sun> = {
  daycare: Sun,
  grooming: Scissors,
  overnights: Moon,
  transport: Car,
};

interface BundleLine {
  service: Service;
  startAt: string;
  endAt: string;
  petIds: string[];
}

/**
 * Build the request lines that go to /portal/bookings.
 *
 *   - No add-ons: single booking line (back-compat shape).
 *   - With add-ons: array of lines. Primary first, then transport
 *     (mirrors primary window), then grooming (mirrors primary window —
 *     the team decides exact slot when they confirm).
 *
 * Transport is single-pet on the staff side; for daycare with multiple
 * pets we still send all the petIds and let staff fan out if needed
 * (better than forcing a split here that loses owner intent).
 */
function buildLines(state: {
  service: Service;
  petIds: string[];
  startAt: string;
  endAt: string;
  addOns: { transport: "on" | "off"; grooming: "on" | "off" };
}): BundleLine[] {
  const primary: BundleLine = {
    service: state.service,
    petIds: state.petIds,
    startAt: state.startAt,
    endAt: state.endAt,
  };
  const lines = [primary];
  if (state.addOns.transport === "on") {
    lines.push({
      service: "transport",
      petIds: state.petIds,
      startAt: state.startAt,
      endAt: state.endAt,
    });
  }
  if (state.addOns.grooming === "on") {
    lines.push({
      service: "grooming",
      petIds: state.petIds,
      startAt: state.startAt,
      endAt: state.endAt,
    });
  }
  return lines;
}

function formatRange(start: string, end: string): { primary: string; secondary: string } {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return {
      primary: s.toLocaleDateString(undefined, dateOpts),
      secondary: `${s.toLocaleTimeString([], timeOpts)} – ${e.toLocaleTimeString([], timeOpts)}`,
    };
  }
  return {
    primary: `${s.toLocaleDateString(undefined, dateOpts)} – ${e.toLocaleDateString(undefined, dateOpts)}`,
    secondary: `${s.toLocaleTimeString([], timeOpts)} → ${e.toLocaleTimeString([], timeOpts)}`,
  };
}

/**
 * Money formatter — CHF is the only currency v1 supports, but we honour
 * whatever code the backend returns so a future per-location currency
 * doesn't break the UI. `Intl.NumberFormat` will gracefully fall back
 * to `code value` formatting for unknown codes.
 */
function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function StepReview() {
  const draft = useBookingDraftStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const qc = useQueryClient();

  const lines = draft.startAt && draft.endAt && draft.service
    ? buildLines({
        service: draft.service,
        petIds: draft.petIds,
        startAt: draft.startAt,
        endAt: draft.endAt,
        addOns: draft.addOns,
      })
    : [];
  const isBundle = lines.length > 1;

  // Build the quote request body once per draft change. Memoised so the
  // queryKey below stays stable across renders.
  const quoteBody = useMemo<QuoteRequest | null>(() => {
    if (!draft.isComplete() || lines.length === 0) return null;
    return {
      items: lines.map((l) => ({
        service: l.service as QuoteService,
        petIds: l.petIds,
        startAt: l.startAt,
        endAt: l.endAt,
      })),
      // locationId is intentionally optional in the QuoteRequest type — if
      // the wizard didn't gather one (grooming/transport flows, or owners
      // who skipped a single-location pick), send null.  Threaded through
      // so quote.* can apply per-location overrides when those land.
      locationId: draft.locationId ?? null,
    };
  }, [lines, draft.isComplete, draft.locationId]);

  // Fetch the estimate. POST under the hood, but expressed as a `useQuery`
  // because the body is a pure function of the draft — same draft, same
  // answer. React Query handles the on-mount fetch + automatic re-fetch
  // when the draft changes (the body string is part of the queryKey).
  const quoteQuery = useQuery<Quote>({
    queryKey: ["portal", "quote", quoteBody],
    queryFn: () => getPortalApi().post<Quote>("/portal/quote", quoteBody!),
    enabled: !!quoteBody,
    staleTime: 60_000,
    retry: 1,
  });

  async function submit() {
    if (!draft.isComplete()) return;
    setBusy(true);
    setErr(null);
    try {
      const submitLines = buildLines({
        service: draft.service!,
        petIds: draft.petIds,
        startAt: draft.startAt!,
        endAt: draft.endAt!,
        addOns: draft.addOns,
      });
      // Single line → original shape (back-compat). Multi → bundle.
      const first = submitLines[0]!;
      const body = submitLines.length === 1
        ? {
            service: first.service,
            petIds: first.petIds,
            startAt: first.startAt,
            endAt: first.endAt,
            notes: draft.notes || null,
            requestId: draft.requestId,
            locationId: draft.locationId ?? null,
          }
        : {
            bundle: submitLines,
            notes: draft.notes || null,
            requestId: draft.requestId,
            locationId: draft.locationId ?? null,
          };
      const r = await getPortalApi().post<{ booking: { id: string } }>("/portal/bookings", body);
      toast.success(submitLines.length > 1 ? "Bundle sent — staff will confirm" : "Request sent — staff will confirm");
      qc.invalidateQueries({ queryKey: ["portal", "home"] });
      qc.invalidateQueries({ queryKey: ["portal", "bookings"] });
      draft.reset();
      nav(`/bookings/${r.booking.id}`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const range = draft.startAt && draft.endAt ? formatRange(draft.startAt, draft.endAt) : null;

  return (
    <>
      <header className="mb-6 anim-fade-in">
        <p className="text-eyebrow mb-2">{isBundle ? "Step 5" : "Step 4"}</p>
        <h1 className="text-display-sm mb-1.5">Review &amp; submit</h1>
        <p className="text-[14px] text-muted-foreground">
          {isBundle
            ? "We'll send the whole bundle to the daycare — they'll confirm everything together."
            : "We'll send this to the daycare for approval."}
        </p>
      </header>

      {/* WHO / WHEN summary card ------------------------------------ */}
      <dl className="rounded-2xl border border-border bg-card p-2 text-sm mb-3 anim-slide-up">
        <ReviewRow
          label="Pets"
          value={draft.petIds.length === 1 ? "1 pet" : `${draft.petIds.length} pets`}
        />
        {range && (
          <>
            <ReviewRow label="When" value={range.primary} />
            <ReviewRow label="Time" value={range.secondary} last />
          </>
        )}
      </dl>

      {/* Bundle line items ------------------------------------------ */}
      <section className="mb-5 anim-slide-up" style={{ animationDelay: "60ms" }}>
        <p className="text-eyebrow mb-2.5">
          {isBundle ? "You're booking" : "Service"}
        </p>
        <ul className="space-y-2">
          {lines.map((line, i) => {
            const Icon = SERVICE_ICON[line.service] ?? Sun;
            return (
              <li
                key={`${line.service}-${i}`}
                className="anim-slide-up flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="size-10 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14.5px] leading-tight">
                    {SERVICE_LABEL[line.service]}
                    {i === 0 && isBundle && (
                      <span className="ml-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                        · primary
                      </span>
                    )}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5 text-tabular">
                    {new Date(line.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {new Date(line.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Pricing estimate ------------------------------------------- */}
      <EstimateSection
        isLoading={quoteQuery.isLoading}
        isError={quoteQuery.isError}
        quote={quoteQuery.data}
        lineCount={lines.length}
      />

      {/* Notes ------------------------------------------------------ */}
      <label className="block mb-6 anim-slide-up" style={{ animationDelay: "120ms" }}>
        <span className="text-eyebrow block mb-2">Notes (optional)</span>
        <textarea
          value={draft.notes}
          onChange={(e) => draft.setNotes(e.target.value)}
          rows={3}
          placeholder={isBundle ? "Anything we should know about the whole visit?" : "Anything we should know?"}
          className="w-full p-3.5 rounded-xl border border-input bg-input-background text-foreground text-[14px] leading-relaxed resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
        />
      </label>

      {err && (
        <p role="alert" className="text-sm text-destructive mb-4 anim-fade-in">{err}</p>
      )}

      <button
        disabled={busy}
        onClick={submit}
        className="press group relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
      >
        <span className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none" aria-hidden="true" />
        <span className="tracking-[-0.005em]">
          {busy ? "Sending…" : isBundle ? `Send bundle (${lines.length})` : "Submit request"}
        </span>
      </button>
    </>
  );
}

/**
 * Pricing/Estimate section. Lives between the bundle list and the notes
 * textarea. Three states:
 *
 *   loading → skeleton lines so the wizard stays responsive
 *   error   → muted single-line message; submit stays enabled
 *   data    → per-line totals, subtotal/tax/total, caveats card
 *
 * We intentionally label this an "Estimate" and never use payment copy
 * (no "Pay", "Charge", etc.) — the portal is request-only in v1.
 */
function EstimateSection({
  isLoading,
  isError,
  quote,
  lineCount,
}: {
  isLoading: boolean;
  isError: boolean;
  quote: Quote | undefined;
  lineCount: number;
}) {
  if (isError) {
    return (
      <section
        className="mb-6 anim-fade-in"
        aria-live="polite"
      >
        <p className="text-eyebrow mb-2.5">Estimate</p>
        <div className="rounded-xl border border-border bg-muted/40 p-3.5">
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            We couldn't fetch a price estimate. The team will share the cost
            when they confirm.
          </p>
        </div>
      </section>
    );
  }

  if (isLoading || !quote) {
    return (
      <section
        className="mb-6 anim-fade-in"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="text-eyebrow mb-2.5">Estimate</p>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
          <div className="pt-3 mt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 anim-slide-up" style={{ animationDelay: "90ms" }}>
      <p className="text-eyebrow mb-2.5">Estimate</p>

      <div className="rounded-2xl border border-border bg-card p-4">
        {/* Per-line totals -------------------------------------------- */}
        <ul className="space-y-2.5">
          {quote.lineItems.map((li, i) => (
            <li
              key={`${li.service}-${i}`}
              className="flex items-baseline justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-foreground truncate">
                  {li.label}
                </p>
                {li.quantity > 1 && (
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 text-tabular">
                    {formatMoney(li.basePrice, quote.currency)} × {li.quantity}
                  </p>
                )}
              </div>
              <span className="text-[13.5px] font-medium text-tabular shrink-0">
                {formatMoney(li.total, quote.currency)}
              </span>
            </li>
          ))}
        </ul>

        {/* Subtotal / tax / total ------------------------------------- */}
        <div className="mt-3.5 pt-3 border-t border-border space-y-1.5">
          <div className="flex items-baseline justify-between gap-4 text-[12.5px] text-muted-foreground">
            <span>Subtotal</span>
            <span className="text-tabular">
              {formatMoney(quote.subtotal, quote.currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-[12.5px] text-muted-foreground">
            <span>Tax</span>
            <span className="text-tabular">
              {formatMoney(quote.taxAmount, quote.currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-1.5">
            <span className="text-[15px] font-semibold tracking-[-0.005em]">
              Total
            </span>
            <span className="text-[16px] font-semibold text-tabular">
              {formatMoney(quote.total, quote.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Caveats card ------------------------------------------------- */}
      <div
        className="mt-2.5 flex gap-2.5 rounded-xl bg-secondary/60 text-secondary-foreground p-3"
        role="note"
      >
        <Info size={15} strokeWidth={2.25} className="shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-[12.5px] leading-relaxed">
          <p className="font-medium">
            This is an estimate — the team will confirm the final price before
            you're charged.
          </p>
          {quote.caveats.length > 0 && (
            <ul className="mt-1.5 space-y-1 list-disc list-outside pl-4 opacity-90">
              {quote.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewRow({
  label, value, last = false,
}: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-3 py-3 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right text-tabular truncate">{value}</dd>
    </div>
  );
}
