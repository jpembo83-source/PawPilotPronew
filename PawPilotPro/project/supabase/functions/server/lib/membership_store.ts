// KV plumbing for lazy membership renewal — the persistence half of
// renewIfDue (lib/membership_catalog.ts). Every live read path (staff list,
// credit use, booking coverage) funnels through here so a membership whose
// billing date has passed is topped up before anyone reads its balance.

import * as kv from '../kv_store.tsx';
import { logInfo, logWarn } from '../_shared/log.ts';
import {
  buildMembershipInvoice,
  monthlyPriceFor,
  renewIfDue,
  type CustomerMembership,
} from './membership_catalog.ts';

/**
 * Write a billing-period invoice into the billing keyspace
 * (invoice:{id} + invoice_line:{invoiceId}:{lineItemId} — the exact shape
 * billing_routes.tsx reads). One invoice per assignment/renewal event,
 * quantity = periods. A membership whose price can't be known (pre-snapshot
 * record with a plan id missing from the compiled catalogue) is not invoiced
 * — logged so finance can follow up — and never blocks the credit grant.
 */
export async function recordMembershipInvoice(
  tenantId: string,
  membership: CustomerMembership,
  periods: number,
  reason: 'assignment' | 'renewal',
  now: Date = new Date(),
): Promise<void> {
  const pricing = monthlyPriceFor(membership);
  if (!pricing) {
    logWarn('memberships.invoice_skipped_unknown_price', {
      membershipId: membership.id,
      planId: membership.package_id,
      periods,
      reason,
    });
    return;
  }

  const household = (await kv.get(
    `customer:${tenantId}:household:${membership.customer_id}`,
  )) as { name?: string } | undefined;

  const { invoice, lineItem } = buildMembershipInvoice({
    invoiceId: crypto.randomUUID(),
    lineItemId: crypto.randomUUID(),
    invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
    membership,
    householdName: household?.name ?? membership.customer_id,
    periods,
    price: pricing.price,
    reason,
    now,
  });

  await kv.set(`invoice:${invoice.id}`, invoice);
  await kv.set(`invoice_line:${invoice.id}:${lineItem.id}`, lineItem);
  logInfo('memberships.invoiced', {
    membershipId: membership.id,
    invoiceId: invoice.id,
    periods,
    total: invoice.total,
    reason,
  });
}

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
  // Each renewal event bills the periods it covered. Never blocks the renewal
  // itself — an invoicing failure is a finance follow-up, not a lost credit.
  try {
    await recordMembershipInvoice(tenantId, renewed, periodsAdvanced, 'renewal', now);
  } catch (err) {
    logWarn('memberships.invoice_failed', {
      membershipId: renewed.id,
      periods: periodsAdvanced,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
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
