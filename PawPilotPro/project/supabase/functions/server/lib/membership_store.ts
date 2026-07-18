// KV plumbing for lazy membership renewal — the persistence half of
// renewIfDue (lib/membership_catalog.ts). Every live read path (staff list,
// credit use, booking coverage) funnels through here so a membership whose
// billing date has passed is topped up before anyone reads its balance.

import * as kv from '../kv_store.tsx';
import { logInfo } from '../_shared/log.ts';
import { renewIfDue, type CustomerMembership } from './membership_catalog.ts';

/**
 * Apply any due renewal to a membership and persist the result. Returns the
 * (possibly renewed) record. Callers pass records straight from KV.
 */
export async function withDueRenewal(
  tenantId: string,
  membership: CustomerMembership,
  now: Date = new Date(),
): Promise<CustomerMembership> {
  const { membership: renewed, periodsAdvanced, creditsGranted } = renewIfDue(membership, now);
  if (periodsAdvanced === 0) return membership;

  await kv.set(`customer_membership:${tenantId}:${renewed.id}`, renewed);
  logInfo('memberships.renewed', {
    membershipId: renewed.id,
    periodsAdvanced,
    creditsGranted,
    nextBillingDate: renewed.next_billing_date,
  });
  return renewed;
}

/**
 * The household's membership for booking coverage: active — or exhausted, in
 * case a due renewal is about to top it back up — renewed, then required to
 * be active. Returns undefined when the household has nothing usable.
 */
export async function activeMembershipForHousehold(
  tenantId: string,
  householdId: string,
  now: Date = new Date(),
): Promise<CustomerMembership | undefined> {
  const memberships = (await kv.getByPrefix(
    `customer_membership:${tenantId}:`,
  )) as CustomerMembership[];
  const candidate = memberships.find(
    (m) =>
      m.customer_id === householdId && (m.status === 'active' || m.status === 'exhausted'),
  );
  if (!candidate) return undefined;

  const current = await withDueRenewal(tenantId, candidate, now);
  return current.status === 'active' ? current : undefined;
}
