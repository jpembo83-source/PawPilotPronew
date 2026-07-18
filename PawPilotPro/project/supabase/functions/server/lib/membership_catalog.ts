// Membership plan catalog + credit maths — server source of truth.
//
// Mirrors src/app/modules/packages/membership-plans.ts (MO01–MO05). The two
// copies MUST stay in sync until a later phase moves the catalog into the KV
// store behind the /pricing/memberships CRUD (see docs/MEMBERSHIP_SYSTEM_PLAN.md,
// Phase 2). Keep this module pure (no KV, no Hono) so it stays unit-testable
// from tests/unit.

export type MembershipTier = 'MO01' | 'MO02' | 'MO03' | 'MO04' | 'MO05';

export interface MembershipPlan {
  id: MembershipTier;
  name: string;
  price: number;
  currency: string;
  sessionType: 'full_day' | 'half_day';
  daysPerMonth: number | 'unlimited';
  serviceType: 'daycare';
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
  package_id: MembershipTier;
  package_name: string;
  package_type: 'credits' | 'unlimited';
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
