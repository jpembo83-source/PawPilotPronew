// Membership plan catalog + credit maths — server source of truth.
//
// Mirrors src/app/modules/packages/membership-plans.ts (MO01–MO05). The two
// copies MUST stay in sync until a later phase moves the catalog into the KV
// store behind the /pricing/memberships CRUD (see docs/MEMBERSHIP_SYSTEM_PLAN.md,
// Phase 2). Keep this module pure (no KV, no Hono) so it stays unit-testable
// from tests/unit.

export type MembershipTier = 'MO01' | 'MO02' | 'MO03' | 'MO04' | 'MO05';

// id is open (not just MembershipTier): admin-created plans from the KV
// catalog (Services & Pricing → Memberships) carry generated ids.
export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  sessionType: 'full_day' | 'half_day';
  daysPerMonth: number | 'unlimited';
  serviceType: 'daycare';
}

/**
 * Normalize a KV catalog record (the Layer-4 MembershipPlan shape managed at
 * /pricing/memberships: accessType/creditsPerMonth/creditUnit/monthlyPrice)
 * into the internal plan shape the assignment and coverage logic run on.
 * Returns null when the record can't drive day-based daycare coverage
 * (hourly credit unit, missing/invalid credits or price) — such plans are
 * not assignable rather than silently mis-covered.
 */
export function normalizeCatalogPlan(record: unknown): MembershipPlan | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;

  const price = typeof r.monthlyPrice === 'number' && r.monthlyPrice >= 0 ? r.monthlyPrice : null;
  if (price === null) return null;

  const unlimited = r.accessType === 'unlimited';
  let daysPerMonth: number | 'unlimited';
  if (unlimited) {
    daysPerMonth = 'unlimited';
  } else if (
    r.accessType === 'credits' &&
    typeof r.creditsPerMonth === 'number' &&
    Number.isInteger(r.creditsPerMonth) &&
    r.creditsPerMonth > 0
  ) {
    daysPerMonth = r.creditsPerMonth;
  } else {
    return null;
  }

  let sessionType: 'full_day' | 'half_day';
  if (r.creditUnit === 'half_day' || r.creditUnit === 'full_day') {
    sessionType = r.creditUnit;
  } else if (unlimited && r.creditUnit === undefined) {
    sessionType = 'full_day';
  } else {
    return null; // 'hour' or malformed — not a day-based daycare plan
  }

  const name =
    (typeof r.displayName === 'string' && r.displayName) ||
    (typeof r.name === 'string' && r.name) ||
    null;
  if (!name) return null;

  return {
    id: r.id,
    name,
    price,
    currency: typeof r.currency === 'string' && r.currency ? r.currency : 'CHF',
    sessionType,
    daysPerMonth,
    serviceType: 'daycare',
  };
}

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'MO01', name: 'SPLIT MY SOCIAL',    price: 493,  currency: 'CHF', sessionType: 'half_day', daysPerMonth: 8,           serviceType: 'daycare' },
  { id: 'MO02', name: 'STAYIN IN CONTACT',  price: 473,  currency: 'CHF', sessionType: 'full_day', daysPerMonth: 5,           serviceType: 'daycare' },
  { id: 'MO03', name: 'FUN ON THE REGULAR', price: 897,  currency: 'CHF', sessionType: 'full_day', daysPerMonth: 10,          serviceType: 'daycare' },
  { id: 'MO04', name: 'ZURICH SOCIALITE',   price: 1255, currency: 'CHF', sessionType: 'full_day', daysPerMonth: 15,          serviceType: 'daycare' },
  { id: 'MO05', name: 'FEAR OF MISSING OUT', price: 1605, currency: 'CHF', sessionType: 'full_day', daysPerMonth: 'unlimited', serviceType: 'daycare' },
];

export function getPlanById(id: string): MembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find((p) => p.id === id);
}

// Matches the client contract in src/app/modules/packages/types.ts
// (CustomerPackage). Persisted at customer_membership:{tenantId}:{id}.
export interface CustomerMembership {
  id: string;
  customer_id: string;
  package_id: string;
  package_name: string;
  package_type: 'credits' | 'unlimited';
  /** Session length the plan covered at assignment time (snapshot — later
   *  plan edits don't retroactively change what an assigned member bought).
   *  Memberships assigned before this field existed fall back to a compiled
   *  catalog lookup in membershipCoverage. */
  session_type?: 'full_day' | 'half_day';
  /** Credits granted each billing period (snapshot at assignment). Renewal
   *  tops up by this amount; pre-snapshot records fall back to the compiled
   *  catalogue. Absent on unlimited plans. */
  monthly_credits?: number;
  /** Price charged each billing period (snapshot at assignment) and its
   *  currency. Invoicing reads these; pre-snapshot records fall back to the
   *  compiled catalogue, and a membership whose price can't be known renews
   *  its credits but is not invoiced (logged for follow-up). */
  monthly_price?: number;
  currency?: string;
  credits_total?: number;
  credits_used?: number;
  credits_remaining?: number;
  purchase_date: string;
  is_subscription: true;
  subscription_status: 'active' | 'paused' | 'cancelled' | 'expired';
  next_billing_date?: string;
  status: 'active' | 'expired' | 'exhausted' | 'cancelled';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export function buildMembership(args: {
  id: string;
  customerId: string;
  plan: MembershipPlan;
  createdBy: string;
  now: Date;
}): CustomerMembership {
  const { id, customerId, plan, createdBy, now } = args;
  const unlimited = plan.daysPerMonth === 'unlimited';
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);
  const iso = now.toISOString();

  return {
    id,
    customer_id: customerId,
    package_id: plan.id,
    package_name: plan.name,
    package_type: unlimited ? 'unlimited' : 'credits',
    session_type: plan.sessionType,
    monthly_price: plan.price,
    currency: plan.currency,
    ...(unlimited
      ? {}
      : {
          credits_total: plan.daysPerMonth as number,
          credits_used: 0,
          credits_remaining: plan.daysPerMonth as number,
          monthly_credits: plan.daysPerMonth as number,
        }),
    purchase_date: iso,
    is_subscription: true,
    subscription_status: 'active',
    next_billing_date: nextBilling.toISOString(),
    status: 'active',
    created_at: iso,
    updated_at: iso,
    created_by: createdBy,
  };
}

/**
 * Session length of a daycare booking, derived from the service id — the one
 * field with stable values on both the staff dialog and the server
 * ('service-daycare-full', 'service-daycare-half-am', 'service-daycare-half-pm').
 * The client's service_type is a UI toggle ('membership' is one of its values)
 * and is never trusted for coverage decisions. Unknown services return null:
 * memberships cover standard daycare sessions only.
 */
export function sessionTypeForServiceId(serviceId: string): 'full_day' | 'half_day' | null {
  if (serviceId === 'service-daycare-full') return 'full_day';
  if (serviceId === 'service-daycare-half-am' || serviceId === 'service-daycare-half-pm') {
    return 'half_day';
  }
  return null;
}

/**
 * Server-authoritative coverage decision for one booking day. Covered when the
 * membership is active, the session type it bought (snapshot, with a compiled
 * catalog fallback for pre-snapshot records) matches the booking's, and (for
 * credits plans) at least one credit remains. Unlimited plans cover without
 * consuming. No live plan lookup — what the member bought is what covers.
 */
export function membershipCoverage(
  membership: CustomerMembership,
  sessionType: 'full_day' | 'half_day' | null,
): { covered: boolean; creditsNeeded: number } {
  const notCovered = { covered: false, creditsNeeded: 0 };
  if (!sessionType || membership.status !== 'active') return notCovered;
  const boughtSession =
    membership.session_type ?? getPlanById(membership.package_id)?.sessionType;
  if (boughtSession !== sessionType) return notCovered;
  if (membership.package_type === 'unlimited') return { covered: true, creditsNeeded: 0 };
  if ((membership.credits_remaining ?? 0) < 1) return notCovered;
  return { covered: true, creditsNeeded: 1 };
}

/**
 * Pure inverse of consumeCredits, for booking cancellation. Returns the
 * membership with the credits handed back (capped at credits_total, floored
 * at zero used) and 'exhausted' flipped back to 'active'. Cancelled/expired
 * memberships still get their ledger corrected — the customer paid for the
 * period the credit belongs to — but their status is left alone.
 */
export function restoreCredits(
  membership: CustomerMembership,
  credits: number,
  now: Date,
): CustomerMembership {
  if (membership.package_type === 'unlimited' || credits <= 0) {
    return { ...membership, updated_at: now.toISOString() };
  }
  const total = membership.credits_total ?? 0;
  const newRemaining = Math.min(total, (membership.credits_remaining ?? 0) + credits);
  return {
    ...membership,
    credits_used: Math.max(0, (membership.credits_used ?? 0) - credits),
    credits_remaining: newRemaining,
    status: membership.status === 'exhausted' && newRemaining > 0 ? 'active' : membership.status,
    updated_at: now.toISOString(),
  };
}

/**
 * Lazy renewal: advance every billing period whose next_billing_date has
 * passed, topping up credits with full rollover (unused days carry — MDC
 * policy). There is no scheduler in this stack, so callers apply this at
 * read/booking time and persist when periodsAdvanced > 0.
 *
 * - credits_total grows by the monthly grant each period (cumulative granted),
 *   keeping the remaining = total − used invariant and the restoreCredits cap.
 * - 'exhausted' flips back to 'active' when new credits arrive.
 * - Unlimited plans just advance the billing date.
 * - Credits plans with an unknown per-period grant (pre-snapshot record whose
 *   plan id isn't in the compiled catalogue) are left untouched — the billing
 *   date does NOT advance, so a later fix can still renew them correctly.
 * - paused/cancelled/expired memberships never renew.
 */
export function renewIfDue(
  membership: CustomerMembership,
  now: Date,
): { membership: CustomerMembership; periodsAdvanced: number; creditsGranted: number } {
  const unchanged = { membership, periodsAdvanced: 0, creditsGranted: 0 };
  if (membership.status !== 'active' && membership.status !== 'exhausted') return unchanged;
  if (!membership.next_billing_date) return unchanged;

  const unlimited = membership.package_type === 'unlimited';
  const grant = unlimited
    ? 0
    : membership.monthly_credits ??
      (() => {
        const days = getPlanById(membership.package_id)?.daysPerMonth;
        return typeof days === 'number' ? days : undefined;
      })();
  if (!unlimited && grant === undefined) return unchanged;

  let next = new Date(membership.next_billing_date);
  if (Number.isNaN(next.getTime())) return unchanged;

  let periods = 0;
  // Bounded: a record can be at most a few periods behind between reads; the
  // cap only guards against a corrupt far-past date spinning the loop.
  while (next.getTime() <= now.getTime() && periods < 24) {
    next = new Date(next);
    next.setMonth(next.getMonth() + 1);
    periods += 1;
  }
  if (periods === 0) return unchanged;

  const creditsGranted = unlimited ? 0 : (grant as number) * periods;
  const renewed: CustomerMembership = {
    ...membership,
    next_billing_date: next.toISOString(),
    ...(unlimited
      ? {}
      : {
          credits_total: (membership.credits_total ?? 0) + creditsGranted,
          credits_remaining: (membership.credits_remaining ?? 0) + creditsGranted,
          monthly_credits: grant,
        }),
    status:
      membership.status === 'exhausted' && creditsGranted > 0 ? 'active' : membership.status,
    updated_at: now.toISOString(),
  };
  return { membership: renewed, periodsAdvanced: periods, creditsGranted };
}

/**
 * Price charged per billing period: the assignment snapshot, or the compiled
 * catalogue for pre-snapshot records. undefined = unknowable (renew credits,
 * skip the invoice, log).
 */
export function monthlyPriceFor(
  membership: CustomerMembership,
): { price: number; currency: string } | undefined {
  if (typeof membership.monthly_price === 'number') {
    return { price: membership.monthly_price, currency: membership.currency ?? 'CHF' };
  }
  const plan = getPlanById(membership.package_id);
  return plan ? { price: plan.price, currency: plan.currency } : undefined;
}

/** The billing keyspace's Invoice/InvoiceLineItem shapes (billing_routes.tsx),
 *  narrowed to the fields membership invoicing writes. */
export interface MembershipInvoice {
  invoice: {
    id: string;
    invoice_number: string;
    household_id: string;
    household_name: string;
    location_id: string;
    location_name: string;
    status: 'issued';
    issue_date: string;
    due_date: string;
    subtotal: number;
    tax_total: number;
    total: number;
    paid_amount: number;
    balance: number;
    tags: string[];
    notes: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  lineItem: {
    id: string;
    invoice_id: string;
    service_id: string;
    service_name: string;
    module: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    discount: number;
    subtotal: number;
    tax_amount: number;
    total: number;
    created_at: string;
  };
}

/**
 * Pure builder for a membership billing-period invoice — one invoice per
 * assignment or renewal event, quantity = periods covered. Membership prices
 * are the published gross figures, so tax_rate is 0 (no VAT re-added on top).
 * Issued immediately (memberships bill on their date, not on staff review);
 * due 14 days after issue. ids are supplied by the caller so this stays pure.
 */
export function buildMembershipInvoice(args: {
  invoiceId: string;
  lineItemId: string;
  invoiceNumber: string;
  membership: CustomerMembership;
  householdName: string;
  periods: number;
  price: number;
  reason: 'assignment' | 'renewal';
  now: Date;
}): MembershipInvoice {
  const { invoiceId, lineItemId, invoiceNumber, membership, householdName, periods, price, reason, now } = args;
  const iso = now.toISOString();
  const due = new Date(now);
  due.setDate(due.getDate() + 14);
  const total = Math.round(price * periods * 100) / 100;

  return {
    invoice: {
      id: invoiceId,
      invoice_number: invoiceNumber,
      household_id: membership.customer_id,
      household_name: householdName,
      location_id: '',
      location_name: '',
      status: 'issued',
      issue_date: iso,
      due_date: due.toISOString(),
      subtotal: total,
      tax_total: 0,
      total,
      paid_amount: 0,
      balance: total,
      tags: ['membership', reason],
      notes: `${membership.package_name} membership — ${reason === 'assignment' ? 'first billing period' : `renewal (${periods} period${periods === 1 ? '' : 's'})`}`,
      created_by: 'memberships',
      created_at: iso,
      updated_at: iso,
    },
    lineItem: {
      id: lineItemId,
      invoice_id: invoiceId,
      service_id: membership.package_id,
      service_name: `${membership.package_name} membership`,
      module: 'memberships',
      quantity: periods,
      unit_price: price,
      tax_rate: 0,
      discount: 0,
      subtotal: total,
      tax_amount: 0,
      total,
      created_at: iso,
    },
  };
}

export type ConsumeError = 'not_active' | 'invalid_credits' | 'insufficient_credits';

/**
 * Pure credit draw-down. Returns the updated membership, or an error code the
 * route maps to a 4xx. Unlimited plans always succeed and track nothing.
 * A credits plan whose balance reaches zero flips to 'exhausted' so booking
 * lookups (status=active) stop offering it.
 */
export function consumeCredits(
  membership: CustomerMembership,
  credits: number,
  now: Date,
): CustomerMembership | ConsumeError {
  if (membership.status !== 'active') return 'not_active';
  if (!Number.isInteger(credits) || credits <= 0) return 'invalid_credits';
  if (membership.package_type === 'unlimited') {
    return { ...membership, updated_at: now.toISOString() };
  }

  const remaining = membership.credits_remaining ?? 0;
  if (credits > remaining) return 'insufficient_credits';

  const newRemaining = remaining - credits;
  return {
    ...membership,
    credits_used: (membership.credits_used ?? 0) + credits,
    credits_remaining: newRemaining,
    status: newRemaining === 0 ? 'exhausted' : 'active',
    updated_at: now.toISOString(),
  };
}
