// Assignment → booking draw-down scenarios for the profile "Membership /
// Package" feature. The booking route wires these pure pieces together
// (daycare_routes.tsx: sessionTypeForServiceId → membershipCoverage →
// consumeCredits → price 0), so these tests pin the behaviour each scenario
// rides on: assigned plans draw down, uncovered extras stay billable,
// custom agreements run the whole engine off their snapshots, and a cleared
// membership reverts bookings to pay-as-you-go.

import { describe, it, expect } from 'vitest';
import {
  buildMembership,
  consumeCredits,
  customPlan,
  getPlanById,
  membershipCoverage,
  monthlyPriceFor,
  renewIfDue,
  sessionTypeForServiceId,
  type CustomerMembership,
  type CustomPlanInput,
} from '../../supabase/functions/server/lib/membership_catalog';

const NOW = new Date('2026-07-24T10:00:00.000Z');

function assignedCataloguePlan(): CustomerMembership {
  return buildMembership({
    id: 'm-1',
    customerId: 'hh-1',
    plan: getPlanById('MO02')!, // 5 full days / month
    createdBy: 'admin-1',
    now: NOW,
  });
}

const ALISHA_AGREEMENT: CustomPlanInput = {
  name: "Alisha's special arrangement",
  price: 350,
  session_type: 'half_day',
  days_per_month: 6,
};

function assignedCustomAgreement(): CustomerMembership {
  return buildMembership({
    id: 'm-custom-1',
    customerId: 'hh-2',
    plan: customPlan(ALISHA_AGREEMENT, 'custom-abc'),
    createdBy: 'admin-1',
    now: NOW,
  });
}

describe('assigned membership drives booking draw-down', () => {
  it('a new full-day daycare booking draws one credit from the assignment', () => {
    const membership = assignedCataloguePlan();
    const sessionType = sessionTypeForServiceId('service-daycare-full');
    const coverage = membershipCoverage(membership, sessionType);
    expect(coverage).toEqual({ covered: true, creditsNeeded: 1 });

    const drawn = consumeCredits(membership, coverage.creditsNeeded, NOW);
    expect(drawn).not.toBeTypeOf('string');
    expect((drawn as CustomerMembership).credits_remaining).toBe(4);
    expect((drawn as CustomerMembership).credits_used).toBe(1);
  });

  it('extra services beyond the plan still bill: uncovered service ids get no coverage', () => {
    const membership = assignedCataloguePlan();
    // Grooming / transport / any non-daycare service id → no session type →
    // the booking route prices it normally (PAYG on top of the membership).
    expect(sessionTypeForServiceId('service-grooming-full')).toBeNull();
    expect(membershipCoverage(membership, null)).toEqual({ covered: false, creditsNeeded: 0 });
  });

  it('extra days beyond the allowance still bill: exhausted credits stop covering', () => {
    let membership = assignedCataloguePlan();
    for (let day = 0; day < 5; day++) {
      membership = consumeCredits(membership, 1, NOW) as CustomerMembership;
    }
    expect(membership.status).toBe('exhausted');
    expect(membership.credits_remaining).toBe(0);
    // Day 6 in the same period is not covered — booked and billed normally.
    expect(membershipCoverage(membership, 'full_day').covered).toBe(false);
  });

  it('session types the plan did not buy still bill (half-day plan, full-day booking)', () => {
    const halfDayPlan = buildMembership({
      id: 'm-2',
      customerId: 'hh-1',
      plan: getPlanById('MO01')!, // 8 half days
      createdBy: 'admin-1',
      now: NOW,
    });
    expect(membershipCoverage(halfDayPlan, 'full_day').covered).toBe(false);
    expect(membershipCoverage(halfDayPlan, 'half_day').covered).toBe(true);
  });
});

describe('custom agreement runs the whole engine off its snapshots', () => {
  it('covers and draws down exactly like a catalogue plan', () => {
    const membership = assignedCustomAgreement();
    expect(membership.package_id).toBe('custom-abc');
    expect(membership.package_name).toBe("Alisha's special arrangement");
    expect(membership.credits_remaining).toBe(6);

    const coverage = membershipCoverage(
      membership,
      sessionTypeForServiceId('service-daycare-half-am')
    );
    expect(coverage).toEqual({ covered: true, creditsNeeded: 1 });

    const drawn = consumeCredits(membership, 1, NOW) as CustomerMembership;
    expect(drawn.credits_remaining).toBe(5);
  });

  it('renews from its snapshot despite having no catalogue entry', () => {
    const membership = assignedCustomAgreement();
    const afterPeriod = new Date('2026-08-25T10:00:00.000Z');
    const { membership: renewed, periodsAdvanced, creditsGranted } = renewIfDue(
      membership,
      afterPeriod
    );
    expect(periodsAdvanced).toBe(1);
    expect(creditsGranted).toBe(6);
    expect(renewed.credits_remaining).toBe(12); // rollover: unused days carry
  });

  it('invoices at the negotiated price via the snapshot', () => {
    expect(monthlyPriceFor(assignedCustomAgreement())).toEqual({
      price: 350,
      currency: 'CHF',
    });
  });

  it('an unlimited custom agreement covers without consuming', () => {
    const unlimited = buildMembership({
      id: 'm-custom-2',
      customerId: 'hh-3',
      plan: customPlan(
        { name: 'Founders all-access', price: 999, session_type: 'full_day', days_per_month: 'unlimited' },
        'custom-def'
      ),
      createdBy: 'admin-1',
      now: NOW,
    });
    expect(unlimited.package_type).toBe('unlimited');
    expect(membershipCoverage(unlimited, 'full_day')).toEqual({ covered: true, creditsNeeded: 0 });
  });
});

describe('clearing the assignment reverts to pay-as-you-go', () => {
  it('a cancelled membership never covers a new booking', () => {
    const cancelled: CustomerMembership = {
      ...assignedCataloguePlan(),
      status: 'cancelled',
      subscription_status: 'cancelled',
    };
    expect(membershipCoverage(cancelled, 'full_day').covered).toBe(false);
    // And the draw path refuses too — belt and braces with the route's
    // status=active lookup filter.
    expect(consumeCredits(cancelled, 1, NOW)).toBe('not_active');
  });

  it('a cancelled membership does not renew', () => {
    const cancelled: CustomerMembership = {
      ...assignedCataloguePlan(),
      status: 'cancelled',
    };
    expect(renewIfDue(cancelled, new Date('2026-12-01T00:00:00.000Z')).periodsAdvanced).toBe(0);
  });
});
