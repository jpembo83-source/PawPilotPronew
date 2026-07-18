import { describe, it, expect } from 'vitest';
import {
  MEMBERSHIP_PLANS,
  getPlanById,
  buildMembership,
  consumeCredits,
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
