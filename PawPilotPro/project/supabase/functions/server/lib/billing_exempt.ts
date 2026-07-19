// House dogs (pet.non_billable) — pure billing-exemption semantics, so the
// vitest unit suite can pin them (no kv/Deno imports).
//
// A house dog occupies capacity exactly like any other dog: capacity counting
// everywhere is booking/reservation-based (daycare capacity counters increment
// per booking; overnight firstFullNight counts non-terminal stays) and never
// consults price or this marker. Billing is where house dogs differ: every
// per-dog charge path zero-prices their records at creation, so nothing
// downstream (invoices, reports, calculate-billing, membership credits) can
// ever show them as owed.

/** True when a pet record carries the house-dog marker. Fail-closed: missing
 *  pet or missing field means BILLABLE (the safe default for revenue). */
export function isNonBillablePet(pet: unknown): boolean {
  return (
    !!pet &&
    typeof pet === "object" &&
    (pet as { non_billable?: unknown }).non_billable === true
  );
}

/** The price a charge path should stamp: zero for house dogs, unchanged
 *  otherwise. Never touches how normal dogs are priced. */
export function chargeablePrice(pet: unknown, price: number): number {
  return isNonBillablePet(pet) ? 0 : price;
}
