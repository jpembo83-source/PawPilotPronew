import { describe, it, expect } from 'vitest';
import {
  MEMBERSHIP_PLANS,
  getPlanById,
  buildMembership,
  consumeCredits,
  membershipCoverage,
  normalizeCatalogPlan,
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
