import { describe, it, expect } from 'vitest';
import {
  overnightStaysForDate,
  overnightOnlyForDate,
  onSiteCount,
  type PlannerOvernightStay,
} from '../../src/app/modules/capacity/components/plannerFormat';
import type { PlannerBooking } from '../../src/app/modules/capacity/types';

const stay = (over: Partial<PlannerOvernightStay> = {}): PlannerOvernightStay => ({
  id: 's1', petId: 'pet-mickey', petName: 'Mickey', startDate: '2026-07-13', endDate: '2026-07-17', ...over,
});

const booking = (over: Partial<PlannerBooking> = {}): PlannerBooking => ({
  id: 'b1', booking_date: '2026-07-15', pet_id: 'pet-luna', pet_name: 'Luna',
  household_id: 'hh1', household_name: 'H', location_id: 'loc1', booking_status: 'confirmed', ...over,
});

describe('overnightStaysForDate', () => {
  it('counts the nights: check-in and last night, but NOT the check-out day', () => {
    const stays = [stay()]; // 13 check-in .. 17 check-out (nights 13,14,15,16)
    expect(overnightStaysForDate(stays, '2026-07-13')).toHaveLength(1); // check-in night
    expect(overnightStaysForDate(stays, '2026-07-15')).toHaveLength(1); // mid
    expect(overnightStaysForDate(stays, '2026-07-16')).toHaveLength(1); // last night
    expect(overnightStaysForDate(stays, '2026-07-17')).toHaveLength(0); // check-out day — leaves AM
  });

  it('excludes dates outside the span', () => {
    const stays = [stay()];
    expect(overnightStaysForDate(stays, '2026-07-12')).toHaveLength(0);
    expect(overnightStaysForDate(stays, '2026-07-18')).toHaveLength(0);
  });

  it('excludes cancelled stays', () => {
    expect(overnightStaysForDate([stay({ status: 'cancelled' })], '2026-07-15')).toHaveLength(0);
  });

  it('returns stays sorted by pet name', () => {
    const stays = [
      stay({ id: 'a', petName: 'Rosie' }),
      stay({ id: 'b', petName: 'Alfie' }),
      stay({ id: 'c', petName: 'Mickey' }),
    ];
    expect(overnightStaysForDate(stays, '2026-07-15').map((s) => s.petName)).toEqual([
      'Alfie', 'Mickey', 'Rosie',
    ]);
  });

  it('handles a single-night stay (check-in night only, out next morning)', () => {
    const stays = [stay({ startDate: '2026-07-13', endDate: '2026-07-14' })];
    expect(overnightStaysForDate(stays, '2026-07-13')).toHaveLength(1); // the one night
    expect(overnightStaysForDate(stays, '2026-07-14')).toHaveLength(0); // check-out day
    expect(overnightStaysForDate(stays, '2026-07-15')).toHaveLength(0);
  });
});

describe('overnightOnlyForDate (dedupe vs daycare)', () => {
  it('drops an overnight stay whose dog is also booked for daycare that day', () => {
    const bookings = [booking({ pet_id: 'pet-mickey', booking_date: '2026-07-15' })];
    const stays = [stay()]; // Mickey, 13–17
    // Mickey has a daycare booking on the 15th, so the overnight line is folded in.
    expect(overnightOnlyForDate(bookings, stays, '2026-07-15')).toHaveLength(0);
    // On the 16th there is no daycare booking, so the overnight shows.
    expect(overnightOnlyForDate(bookings, stays, '2026-07-16')).toHaveLength(1);
  });

  it('keeps overnight stays with no matching daycare booking', () => {
    const bookings = [booking({ pet_id: 'pet-luna' })];
    expect(overnightOnlyForDate(bookings, [stay()], '2026-07-15')).toHaveLength(1);
  });
});

describe('onSiteCount (single pane)', () => {
  it('sums daycare bookings and overnight boarders present that day', () => {
    const bookings = [
      booking({ id: 'b1', pet_id: 'pet-luna', booking_date: '2026-07-15' }),
      booking({ id: 'b2', pet_id: 'pet-alfie', booking_date: '2026-07-15' }),
    ];
    const stays = [stay()]; // Mickey boarding 13–17
    expect(onSiteCount(bookings, stays, '2026-07-15')).toBe(3);
  });

  it('counts a converging dog once (daycare + overnight same dog)', () => {
    const bookings = [booking({ pet_id: 'pet-mickey', booking_date: '2026-07-15' })];
    const stays = [stay()]; // Mickey also boarding
    expect(onSiteCount(bookings, stays, '2026-07-15')).toBe(1);
  });

  it('counts overnight-only dogs on days with no daycare bookings', () => {
    expect(onSiteCount([], [stay()], '2026-07-16')).toBe(1);
    expect(onSiteCount([], [stay()], '2026-07-20')).toBe(0);
  });
});
