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
    ...(unlimited
      ? {}
      : {
          credits_total: plan.daysPerMonth as number,
          credits_used: 0,
          credits_remaining: plan.daysPerMonth as number,
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
