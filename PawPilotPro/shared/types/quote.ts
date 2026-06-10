/**
 * Owner-facing quote contract for the client portal.
 *
 * v1 is **Estimate mode** — the totals returned by `/portal/quote` are a
 * best-effort snapshot derived from service KV entries and the same logic
 * that staff-side `/pricing/resolve` (pricing_routes.tsx:365-477) uses,
 * but with every uncertainty surfaced as a plain-English caveat. Real,
 * committable pricing still lives staff-side: this contract intentionally
 * does NOT replace `/pricing/resolve`, it just exposes a read-only
 * summary for owner UX.
 *
 * Why "Estimate" and not a binding price:
 *   - No membership ledger yet (can't honestly say "credits cover this")
 *   - Multi-dog discounts, packages, and discount codes are dead code
 *     in bookings — not plumbed yet
 *   - VIP household flag doesn't exist
 *   - Late-pickup fees depend on actual checkout time
 *   - Currency is hardcoded CHF tenant-wide; tax is 0.077 fallback
 *
 * Why the 15-minute expiry on `quoteExpiresAt`:
 *   The quote is a *snapshot*, not a contract. The owner should not be
 *   tapping "Submit" on a total that was computed an hour ago. The
 *   short window signals freshness, and the portal should re-quote on
 *   navigation back to the review screen.
 */

export type QuoteService = "daycare" | "grooming" | "overnights" | "transport";

// Request a quote for one or more service line items.
export interface QuoteRequest {
  items: QuoteRequestItem[];
  locationId?: string | null;
}

export interface QuoteRequestItem {
  service: QuoteService;
  petIds: string[];
  startAt: string; // ISO
  endAt: string;   // ISO
}

// Response with per-line + total + caveats. Always Estimate mode for v1.
export interface Quote {
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  /**
   * Currency code, e.g. "CHF". Hardcoded tenant-wide today; a caveat is
   * emitted reminding the owner that currency may vary by location.
   */
  currency: string;
  /**
   * User-facing, plain English. Surfaced verbatim in the portal review
   * screen so the owner sees exactly what staff will reconcile later.
   */
  caveats: string[];
  /**
   * ISO, ~15 min from generation. The portal must re-quote past this.
   */
  quoteExpiresAt: string;
  /**
   * Discriminator — this contract is never a binding price. Always true
   * in v1; kept as a literal so call sites can narrow safely if a real
   * `Quote` ever ships alongside.
   */
  estimate: true;
}

export interface QuoteLineItem {
  service: QuoteService;
  /**
   * Human label for the line, e.g. "Daycare · Luna" or
   * "Daycare · 2 dogs · 1 day". Owner-facing.
   */
  label: string;
  basePrice: number; // per-unit
  /**
   * Number of pets × days spanned for daycare/overnights, or 1 for
   * grooming/transport (single-shot services).
   */
  quantity: number;
  subtotal: number;  // basePrice * quantity (pre-tax)
  taxRate: number;   // e.g. 0.077
  taxAmount: number;
  total: number;     // subtotal + taxAmount
  /**
   * Where `basePrice` came from. "service-kv" = real entry, "default" =
   * fallback (e.g. daycare 99.00 in portal_bookings line 715), "unknown"
   * = no price set, expect a caveat telling the owner staff will confirm.
   */
  priceSource: "service-kv" | "default" | "unknown";
  /**
   * Line-specific caveats (e.g. "Multi-dog discount may apply",
   * "Membership credits may cover this"). Aggregated into the
   * top-level `Quote.caveats` for the review screen.
   */
  caveats: string[];
}
