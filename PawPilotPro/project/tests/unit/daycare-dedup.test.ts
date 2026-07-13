import { describe, it, expect } from 'vitest';
import {
  timeWindowsOverlap,
  findDuplicateBooking,
  type DedupBooking,
} from '../../supabase/functions/server/lib/daycare_dedup.ts';

describe('timeWindowsOverlap', () => {
  it('two full days overlap', () => {
    expect(timeWindowsOverlap('07:00', '18:00', '07:00', '18:00')).toBe(true);
  });
  it('AM and PM half-days touch but do not overlap', () => {
    expect(timeWindowsOverlap('07:00', '13:00', '13:00', '18:00')).toBe(false);
  });
  it('full day overlaps a half day', () => {
    expect(timeWindowsOverlap('07:00', '18:00', '07:00', '13:00')).toBe(true);
  });
  it('two AM half-days overlap', () => {
    expect(timeWindowsOverlap('07:00', '13:00', '07:00', '13:00')).toBe(true);
  });
  it('missing times are treated as full-day presence (conflict)', () => {
    expect(timeWindowsOverlap(undefined, undefined, '07:00', '13:00')).toBe(true);
    expect(timeWindowsOverlap('07:00', '13:00', 'bad', '13:00')).toBe(true);
  });
});

const bk = (o: Partial<DedupBooking> = {}): DedupBooking => ({
  id: 'b1', pet_id: 'pet-meg', location_id: 'loc-1', booking_date: '2026-07-13',
  planned_start_time: '07:00', planned_end_time: '18:00', booking_status: 'confirmed', ...o,
});

describe('findDuplicateBooking', () => {
  it('flags an identical same-day full-day booking', () => {
    const hit = findDuplicateBooking([bk({ id: 'existing' })], bk({ id: 'new' }));
    expect(hit?.id).toBe('existing');
  });

  it('allows an afternoon booking when only a morning exists', () => {
    const existing = [bk({ id: 'am', planned_start_time: '07:00', planned_end_time: '13:00' })];
    const candidate = bk({ id: 'pm', planned_start_time: '13:00', planned_end_time: '18:00' });
    expect(findDuplicateBooking(existing, candidate)).toBeNull();
  });

  it('ignores cancelled / no-show bookings', () => {
    expect(findDuplicateBooking([bk({ booking_status: 'cancelled' })], bk())).toBeNull();
    expect(findDuplicateBooking([bk({ booking_status: 'no_show' })], bk())).toBeNull();
  });

  it('does not clash across different pet, location, or date', () => {
    expect(findDuplicateBooking([bk({ pet_id: 'pet-other' })], bk())).toBeNull();
    expect(findDuplicateBooking([bk({ location_id: 'loc-2' })], bk())).toBeNull();
    expect(findDuplicateBooking([bk({ booking_date: '2026-07-14' })], bk())).toBeNull();
  });

  it('skips excluded ids (e.g. the booking being edited)', () => {
    expect(findDuplicateBooking([bk({ id: 'self' })], bk({ id: 'self' }), new Set(['self']))).toBeNull();
  });

  it('returns null when the candidate is missing key fields', () => {
    expect(findDuplicateBooking([bk()], bk({ pet_id: undefined }))).toBeNull();
  });
});
