// overnight_daycare_semantics: "day after the final night is a daycare day" —
// date/service mapping and the create/skip decision.
import { describe, it, expect } from 'vitest';
import {
  decideMorningDaycare,
  MORNING_DAYCARE_SERVICES,
  morningAfterDate,
} from '../../supabase/functions/server/lib/overnight_daycare_semantics';

const booking = (overrides: Record<string, unknown> = {}) => ({
  id: 'daybook-1',
  pet_id: 'pet-1',
  location_id: 'loc-1',
  booking_date: '2026-08-05',
  planned_start_time: '07:00',
  planned_end_time: '18:00',
  booking_status: 'confirmed',
  ...overrides,
});

const decide = (overrides: Record<string, unknown> = {}) =>
  decideMorningDaycare({
    existingBookings: [],
    capacity: { max_capacity: 19, current_bookings: 0 },
    petId: 'pet-1',
    petName: 'Rex',
    locationId: 'loc-1',
    date: '2026-08-05',
    choice: 'full',
    ...overrides,
  });

describe('morningAfterDate', () => {
  it('is the check-out date — the morning after the final night', () => {
    expect(morningAfterDate({ endDate: '2026-08-05' })).toBe('2026-08-05');
  });
});

describe('MORNING_DAYCARE_SERVICES', () => {
  it('full maps to the canonical full-day service', () => {
    expect(MORNING_DAYCARE_SERVICES.full).toMatchObject({
      serviceId: 'service-daycare-full',
      serviceType: 'full_day',
      start: '07:00',
      end: '18:00',
    });
  });

  it('half maps to the AM half-day (it is the check-out morning)', () => {
    expect(MORNING_DAYCARE_SERVICES.half).toMatchObject({
      serviceId: 'service-daycare-half-am',
      serviceType: 'half_day_am',
      start: '07:00',
      end: '13:00',
    });
  });
});

describe('decideMorningDaycare', () => {
  it('creates when the morning is free and daycare has room', () => {
    expect(decide()).toEqual({ outcome: 'create' });
  });

  it('skips (with the existing id) when the pet already has a booking that morning', () => {
    const d = decide({ existingBookings: [booking()] });
    expect(d.outcome).toBe('skip_duplicate');
    if (d.outcome === 'skip_duplicate') {
      expect(d.existingBookingId).toBe('daybook-1');
      expect(d.warning).toContain('Rex');
      expect(d.warning).toContain('2026-08-05');
    }
  });

  it('a cancelled booking that morning does not block', () => {
    expect(decide({ existingBookings: [booking({ booking_status: 'cancelled' })] })).toEqual({
      outcome: 'create',
    });
  });

  it("another pet's booking or another date does not block", () => {
    expect(decide({ existingBookings: [booking({ pet_id: 'pet-2' })] })).toEqual({ outcome: 'create' });
    expect(decide({ existingBookings: [booking({ booking_date: '2026-08-06' })] })).toEqual({
      outcome: 'create',
    });
  });

  it('an existing PM half-day does not block an AM half-day (split day)', () => {
    const pm = booking({ planned_start_time: '13:00', planned_end_time: '18:00' });
    expect(decide({ existingBookings: [pm], choice: 'half' })).toEqual({ outcome: 'create' });
    // ...but a FULL day request overlaps the PM booking and is a duplicate.
    expect(decide({ existingBookings: [pm], choice: 'full' }).outcome).toBe('skip_duplicate');
  });

  it('skips with a warning when daycare is full that day', () => {
    const d = decide({ capacity: { max_capacity: 19, current_bookings: 19 } });
    expect(d.outcome).toBe('skip_full');
    if (d.outcome === 'skip_full') {
      expect(d.warning).toContain('full');
      expect(d.warning).toContain('2026-08-05');
    }
  });

  it('duplicate wins over full — an already-booked dog is covered, not an error', () => {
    const d = decide({
      existingBookings: [booking()],
      capacity: { max_capacity: 19, current_bookings: 19 },
    });
    expect(d.outcome).toBe('skip_duplicate');
  });

  it('missing capacity record means unenforced — create', () => {
    expect(decide({ capacity: null })).toEqual({ outcome: 'create' });
  });
});
