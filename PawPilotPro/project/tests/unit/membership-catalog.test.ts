import { describe, it, expect } from 'vitest';
import {
  MEMBERSHIP_PLANS,
  getPlanById,
  buildMembership,
  consumeCredits,
  buildMembershipInvoice,
  membershipCoverage,
  monthlyPriceFor,
  normalizeCatalogPlan,
  renewIfDue,
  restoreCredits,
  sessionTypeForServiceId,
  type CustomerMembership,
} from '../../supabase/functions/server/lib/membership_catalog';
import { MEMBERSHIP_PLANS as CLIENT_PLANS } from '../../src/app/modules/packages/membership-plans';

const NOW = new Date('2026-07-18T10:00:00.000Z');

function creditsMembership(): CustomerMembership {
  return buildMembership({
    id: 'm-1',
    customerId: 'h-1',
    plan: getPlanById('MO02')!, // 5 full days/month
    createdBy: 'u-1',
    now: NOW,
  });
}

describe('membership catalog', () => {
  it('stays in sync with the client catalog (id, name, price, days)', () => {
    // The client file is the catalog staff see; the server copy is what gets
    // enforced. Drift between them means the UI sells one thing and the
    // backend grants another.
    expect(MEMBERSHIP_PLANS).toHaveLength(CLIENT_PLANS.length);
    for (const server of MEMBERSHIP_PLANS) {
      const client = CLIENT_PLANS.find((p) => p.id === server.id);
      expect(client, `plan ${server.id} missing client-side`).toBeDefined();
      expect(server.name).toBe(client!.name);
      expect(server.price).toBe(client!.price);
      expect(server.daysPerMonth).toBe(client!.daysPerMonth);
      expect(server.sessionType).toBe(client!.sessionType);
    }
  });

  it('getPlanById rejects unknown ids', () => {
    expect(getPlanById('MO99')).toBeUndefined();
    expect(getPlanById('')).toBeUndefined();
  });
});

describe('buildMembership', () => {
  it('grants the plan monthly days as credits', () => {
    const m = creditsMembership();
    expect(m.package_type).toBe('credits');
    expect(m.credits_total).toBe(5);
    expect(m.credits_remaining).toBe(5);
    expect(m.credits_used).toBe(0);
    expect(m.status).toBe('active');
    expect(m.next_billing_date).toBe('2026-08-18T10:00:00.000Z');
  });

  it('unlimited plans carry no credit fields', () => {
    const m = buildMembership({
      id: 'm-2',
      customerId: 'h-1',
      plan: getPlanById('MO05')!,
      createdBy: 'u-1',
      now: NOW,
    });
    expect(m.package_type).toBe('unlimited');
    expect(m.credits_total).toBeUndefined();
    expect(m.credits_remaining).toBeUndefined();
  });
});

describe('consumeCredits', () => {
  it('draws down and flips to exhausted at zero', () => {
    let m = creditsMembership();
    m = consumeCredits(m, 4, NOW) as CustomerMembership;
    expect(m.credits_remaining).toBe(1);
    expect(m.credits_used).toBe(4);
    expect(m.status).toBe('active');

    m = consumeCredits(m, 1, NOW) as CustomerMembership;
    expect(m.credits_remaining).toBe(0);
    expect(m.status).toBe('exhausted');
  });

  it('rejects overdraw, zero, negative, and fractional credits', () => {
    const m = creditsMembership();
    expect(consumeCredits(m, 6, NOW)).toBe('insufficient_credits');
    expect(consumeCredits(m, 0, NOW)).toBe('invalid_credits');
    expect(consumeCredits(m, -1, NOW)).toBe('invalid_credits');
    expect(consumeCredits(m, 1.5, NOW)).toBe('invalid_credits');
  });

  it('rejects non-active memberships', () => {
    const m = { ...creditsMembership(), status: 'cancelled' as const };
    expect(consumeCredits(m, 1, NOW)).toBe('not_active');
    const e = { ...creditsMembership(), status: 'exhausted' as const };
    expect(consumeCredits(e, 1, NOW)).toBe('not_active');
  });

  it('unlimited plans always succeed and never track usage', () => {
    const m = buildMembership({
      id: 'm-3',
      customerId: 'h-1',
      plan: getPlanById('MO05')!,
      createdBy: 'u-1',
      now: NOW,
    });
    const after = consumeCredits(m, 1, NOW) as CustomerMembership;
    expect(after.status).toBe('active');
    expect(after.credits_remaining).toBeUndefined();
  });

  it('does not mutate the input membership', () => {
    const m = creditsMembership();
    consumeCredits(m, 2, NOW);
    expect(m.credits_remaining).toBe(5);
  });
});

describe('sessionTypeForServiceId', () => {
  it('maps the three staff-dialog daycare services', () => {
    expect(sessionTypeForServiceId('service-daycare-full')).toBe('full_day');
    expect(sessionTypeForServiceId('service-daycare-half-am')).toBe('half_day');
    expect(sessionTypeForServiceId('service-daycare-half-pm')).toBe('half_day');
  });

  it('returns null for anything else (memberships cover daycare sessions only)', () => {
    expect(sessionTypeForServiceId('service-grooming-full')).toBeNull();
    expect(sessionTypeForServiceId('')).toBeNull();
  });
});

describe('membershipCoverage', () => {
  it('covers a matching session type at 1 credit', () => {
    expect(membershipCoverage(creditsMembership(), 'full_day')).toEqual({
      covered: true,
      creditsNeeded: 1,
    });
  });

  it('does not cover a mismatched session type', () => {
    // MO02 is a full-day plan; a half-day booking is PAYG.
    expect(membershipCoverage(creditsMembership(), 'half_day').covered).toBe(false);
    // MO01 is the half-day plan; a full-day booking is PAYG.
    const halfPlan = buildMembership({
      id: 'm-h', customerId: 'h-1', plan: getPlanById('MO01')!, createdBy: 'u-1', now: NOW,
    });
    expect(membershipCoverage(halfPlan, 'full_day').covered).toBe(false);
    expect(membershipCoverage(halfPlan, 'half_day').covered).toBe(true);
  });

  it('does not cover non-daycare sessions, inactive memberships, or empty balances', () => {
    expect(membershipCoverage(creditsMembership(), null).covered).toBe(false);
    const cancelled = { ...creditsMembership(), status: 'cancelled' as const };
    expect(membershipCoverage(cancelled, 'full_day').covered).toBe(false);
    const empty = { ...creditsMembership(), credits_remaining: 0 };
    expect(membershipCoverage(empty, 'full_day').covered).toBe(false);
  });

  it('unlimited plans cover without consuming', () => {
    const unlimited = buildMembership({
      id: 'm-u', customerId: 'h-1', plan: getPlanById('MO05')!, createdBy: 'u-1', now: NOW,
    });
    expect(membershipCoverage(unlimited, 'full_day')).toEqual({
      covered: true,
      creditsNeeded: 0,
    });
  });
});

describe('normalizeCatalogPlan (managed KV catalogue → internal plan)', () => {
  const base = {
    id: 'plan-custom-1',
    name: 'CUST01',
    displayName: 'Custom Plan',
    monthlyPrice: 500,
    currency: 'CHF',
    accessType: 'credits',
    creditsPerMonth: 12,
    creditUnit: 'full_day',
  };

  it('maps a credits plan (displayName preferred, creditUnit → sessionType)', () => {
    expect(normalizeCatalogPlan(base)).toEqual({
      id: 'plan-custom-1',
      name: 'Custom Plan',
      price: 500,
      currency: 'CHF',
      sessionType: 'full_day',
      daysPerMonth: 12,
      serviceType: 'daycare',
    });
  });

  it('maps an unlimited plan and defaults its session to full_day', () => {
    const p = normalizeCatalogPlan({ ...base, accessType: 'unlimited', creditsPerMonth: undefined, creditUnit: undefined });
    expect(p?.daysPerMonth).toBe('unlimited');
    expect(p?.sessionType).toBe('full_day');
  });

  it('rejects shapes bookings cannot honour', () => {
    expect(normalizeCatalogPlan({ ...base, creditUnit: 'hour' })).toBeNull();
    expect(normalizeCatalogPlan({ ...base, creditsPerMonth: undefined })).toBeNull();
    expect(normalizeCatalogPlan({ ...base, creditsPerMonth: 0 })).toBeNull();
    expect(normalizeCatalogPlan({ ...base, monthlyPrice: -1 })).toBeNull();
    expect(normalizeCatalogPlan({ ...base, id: '' })).toBeNull();
    expect(normalizeCatalogPlan(null)).toBeNull();
    expect(normalizeCatalogPlan('nope')).toBeNull();
  });

  it('a normalized custom plan flows through buildMembership + coverage', () => {
    const plan = normalizeCatalogPlan({ ...base, creditUnit: 'half_day' })!;
    const m = buildMembership({ id: 'm-c', customerId: 'h-1', plan, createdBy: 'u-1', now: NOW });
    expect(m.session_type).toBe('half_day');
    expect(m.credits_total).toBe(12);
    // Coverage works from the snapshot even though the id isn't in the
    // compiled catalogue.
    expect(membershipCoverage(m, 'half_day')).toEqual({ covered: true, creditsNeeded: 1 });
    expect(membershipCoverage(m, 'full_day').covered).toBe(false);
  });
});

describe('membershipCoverage session snapshot', () => {
  it('pre-snapshot records (no session_type) fall back to the compiled catalogue', () => {
    const legacy = { ...creditsMembership() };
    delete legacy.session_type;
    // MO02 is full-day in the compiled catalogue.
    expect(membershipCoverage(legacy, 'full_day').covered).toBe(true);
    expect(membershipCoverage(legacy, 'half_day').covered).toBe(false);
  });

  it('the snapshot wins over the catalogue when both exist', () => {
    const m = { ...creditsMembership(), session_type: 'half_day' as const };
    expect(membershipCoverage(m, 'half_day').covered).toBe(true);
    expect(membershipCoverage(m, 'full_day').covered).toBe(false);
  });
});

describe('restoreCredits', () => {
  it('hands a consumed credit back and un-exhausts', () => {
    let m = creditsMembership();
    m = consumeCredits(m, 5, NOW) as CustomerMembership;
    expect(m.status).toBe('exhausted');

    m = restoreCredits(m, 1, NOW);
    expect(m.credits_remaining).toBe(1);
    expect(m.credits_used).toBe(4);
    expect(m.status).toBe('active');
  });

  it('caps at credits_total and floors used at zero (double-restore safety)', () => {
    const m = restoreCredits(creditsMembership(), 3, NOW);
    expect(m.credits_remaining).toBe(5);
    expect(m.credits_used).toBe(0);
  });

  it('leaves a cancelled membership cancelled while correcting the balance', () => {
    let m = consumeCredits(creditsMembership(), 2, NOW) as CustomerMembership;
    m = { ...m, status: 'cancelled' as const };
    const restored = restoreCredits(m, 2, NOW);
    expect(restored.status).toBe('cancelled');
    expect(restored.credits_remaining).toBe(5);
  });

  it('is a no-op for unlimited plans and zero credits', () => {
    const unlimited = buildMembership({
      id: 'm-u2', customerId: 'h-1', plan: getPlanById('MO05')!, createdBy: 'u-1', now: NOW,
    });
    expect(restoreCredits(unlimited, 1, NOW).credits_remaining).toBeUndefined();
    expect(restoreCredits(creditsMembership(), 0, NOW).credits_remaining).toBe(5);
  });
});

describe('renewIfDue (lazy renewal + rollover)', () => {
  // Assigned 2026-07-18 → next_billing 2026-08-18 (MO02: 5 full days/month).
  const AFTER_ONE = new Date('2026-08-20T09:00:00.000Z');
  const AFTER_THREE = new Date('2026-10-20T09:00:00.000Z');

  it('is a no-op before the billing date', () => {
    const r = renewIfDue(creditsMembership(), new Date('2026-08-17T00:00:00.000Z'));
    expect(r.periodsAdvanced).toBe(0);
    expect(r.creditsGranted).toBe(0);
  });

  it('tops up one period with full rollover (unused days carry)', () => {
    let m = creditsMembership();
    m = consumeCredits(m, 2, NOW) as CustomerMembership; // 3 remain of 5
    const r = renewIfDue(m, AFTER_ONE);
    expect(r.periodsAdvanced).toBe(1);
    expect(r.creditsGranted).toBe(5);
    expect(r.membership.credits_remaining).toBe(8); // 3 carried + 5 granted
    expect(r.membership.credits_total).toBe(10); // cumulative granted
    expect(r.membership.credits_used).toBe(2);
    expect(r.membership.next_billing_date).toBe('2026-09-18T10:00:00.000Z');
  });

  it('catches up multiple missed periods at once', () => {
    const r = renewIfDue(creditsMembership(), AFTER_THREE);
    expect(r.periodsAdvanced).toBe(3);
    expect(r.creditsGranted).toBe(15);
    expect(r.membership.credits_remaining).toBe(20);
    expect(r.membership.next_billing_date).toBe('2026-11-18T10:00:00.000Z');
  });

  it('flips exhausted back to active when credits arrive', () => {
    let m = creditsMembership();
    m = consumeCredits(m, 5, NOW) as CustomerMembership;
    expect(m.status).toBe('exhausted');
    const r = renewIfDue(m, AFTER_ONE);
    expect(r.membership.status).toBe('active');
    expect(r.membership.credits_remaining).toBe(5);
  });

  it('unlimited plans only advance the billing date', () => {
    const u = buildMembership({
      id: 'm-u3', customerId: 'h-1', plan: getPlanById('MO05')!, createdBy: 'u-1', now: NOW,
    });
    const r = renewIfDue(u, AFTER_ONE);
    expect(r.periodsAdvanced).toBe(1);
    expect(r.creditsGranted).toBe(0);
    expect(r.membership.credits_remaining).toBeUndefined();
    expect(r.membership.next_billing_date).toBe('2026-09-18T10:00:00.000Z');
  });

  it('never renews paused or cancelled memberships', () => {
    const cancelled = { ...creditsMembership(), status: 'cancelled' as const };
    expect(renewIfDue(cancelled, AFTER_THREE).periodsAdvanced).toBe(0);
  });

  it('pre-snapshot records fall back to the compiled catalogue for the grant', () => {
    const legacy = { ...creditsMembership() };
    delete legacy.monthly_credits;
    const r = renewIfDue(legacy, AFTER_ONE);
    expect(r.creditsGranted).toBe(5); // MO02 from the compiled catalogue
    expect(r.membership.monthly_credits).toBe(5); // snapshot backfilled
  });

  it('leaves a credits record with an unknowable grant untouched (date included)', () => {
    const orphan = { ...creditsMembership(), package_id: 'gone-plan' };
    delete orphan.monthly_credits;
    const r = renewIfDue(orphan, AFTER_ONE);
    expect(r.periodsAdvanced).toBe(0);
    expect(r.membership.next_billing_date).toBe(creditsMembership().next_billing_date);
  });

  it('restore cap stays correct after renewal (cumulative credits_total)', () => {
    let m = creditsMembership();
    m = consumeCredits(m, 4, NOW) as CustomerMembership; // 1 of 5 left
    m = renewIfDue(m, AFTER_ONE).membership; // 6 left of 10 total
    m = restoreCredits(m, 4, NOW); // cancellation hands 4 back
    expect(m.credits_remaining).toBe(10);
    expect(m.credits_used).toBe(0);
  });
});

describe('monthlyPriceFor', () => {
  it('prefers the assignment snapshot', () => {
    // buildMembership snapshots the plan price (MO02 = 473 CHF).
    expect(monthlyPriceFor(creditsMembership())).toEqual({ price: 473, currency: 'CHF' });
    const custom = { ...creditsMembership(), monthly_price: 550, currency: 'EUR' };
    expect(monthlyPriceFor(custom)).toEqual({ price: 550, currency: 'EUR' });
  });

  it('pre-snapshot records fall back to the compiled catalogue', () => {
    const legacy = { ...creditsMembership() };
    delete legacy.monthly_price;
    expect(monthlyPriceFor(legacy)).toEqual({ price: 473, currency: 'CHF' });
  });

  it('returns undefined when the price is unknowable', () => {
    const orphan = { ...creditsMembership(), package_id: 'gone-plan' };
    delete orphan.monthly_price;
    expect(monthlyPriceFor(orphan)).toBeUndefined();
  });
});

describe('buildMembershipInvoice', () => {
  function invoiceArgs(overrides: Partial<Parameters<typeof buildMembershipInvoice>[0]> = {}) {
    return {
      invoiceId: 'inv-1',
      lineItemId: 'line-1',
      invoiceNumber: 'INV-TEST-1',
      membership: creditsMembership(),
      householdName: 'The Testers',
      periods: 1,
      price: 473,
      reason: 'assignment' as const,
      now: NOW,
      ...overrides,
    };
  }

  it('issues immediately, due in 14 days, balance = total, tax 0 (gross prices)', () => {
    const { invoice, lineItem } = buildMembershipInvoice(invoiceArgs());
    expect(invoice.status).toBe('issued');
    expect(invoice.issue_date).toBe('2026-07-18T10:00:00.000Z');
    expect(invoice.due_date).toBe('2026-08-01T10:00:00.000Z');
    expect(invoice.subtotal).toBe(473);
    expect(invoice.tax_total).toBe(0);
    expect(invoice.total).toBe(473);
    expect(invoice.paid_amount).toBe(0);
    expect(invoice.balance).toBe(473);
    expect(invoice.household_id).toBe('h-1');
    expect(invoice.household_name).toBe('The Testers');
    expect(invoice.tags).toEqual(['membership', 'assignment']);
    expect(lineItem.invoice_id).toBe('inv-1');
    expect(lineItem.service_id).toBe('MO02');
    expect(lineItem.module).toBe('memberships');
    expect(lineItem.quantity).toBe(1);
    expect(lineItem.unit_price).toBe(473);
  });

  it('a multi-period renewal bills quantity = periods on one invoice', () => {
    const { invoice, lineItem } = buildMembershipInvoice(
      invoiceArgs({ periods: 3, reason: 'renewal' }),
    );
    expect(lineItem.quantity).toBe(3);
    expect(invoice.total).toBe(1419);
    expect(invoice.balance).toBe(1419);
    expect(invoice.tags).toEqual(['membership', 'renewal']);
    expect(invoice.notes).toContain('renewal (3 periods)');
  });

  it('rounds fractional totals to 2 decimals', () => {
    const { invoice } = buildMembershipInvoice(invoiceArgs({ price: 33.335, periods: 3 }));
    expect(invoice.total).toBe(100.01);
  });
});
