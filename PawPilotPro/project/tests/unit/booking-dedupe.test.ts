import { describe, it, expect } from 'vitest';
import './setup';
import { dayKeyOf, findSameDayConflict } from '../../supabase/functions/server/portal_bookings.ts';

const mk = (over: Record<string, unknown> = {}) => ({
  id: 'b1', status: 'pending', service: 'daycare',
  petIds: ['pet-1'], startAt: '2026-06-11T09:00:00Z', ...over,
});

describe('dayKeyOf', () => {
  it('buckets by UTC start date', () => {
    expect(dayKeyOf('2026-06-11T09:00:00Z')).toBe('2026-06-11');
    expect(dayKeyOf('2026-06-11T23:59:59Z')).toBe('2026-06-11');
  });
});

describe('findSameDayConflict', () => {
  it('flags same pet + service + day, any overlap of pets', () => {
    const hit = findSameDayConflict([mk()], { service: 'daycare', petIds: ['pet-1', 'pet-2'], startAt: '2026-06-11T14:00:00Z' });
    expect(hit?.id).toBe('b1');
  });
  it('ignores cancelled and declined bookings (owners may re-request)', () => {
    expect(findSameDayConflict([mk({ status: 'cancelled' })], mk())).toBeNull();
    expect(findSameDayConflict([mk({ status: 'declined' })], mk())).toBeNull();
  });
  it('different service, pet, or day does not conflict', () => {
    expect(findSameDayConflict([mk({ service: 'grooming' })], mk())).toBeNull();
    expect(findSameDayConflict([mk({ petIds: ['pet-9'] })], mk())).toBeNull();
    expect(findSameDayConflict([mk({ startAt: '2026-06-12T09:00:00Z' })], mk())).toBeNull();
  });
  it('excludeIds prevents a bundle from conflicting with itself', () => {
    expect(findSameDayConflict([mk()], mk(), new Set(['b1']))).toBeNull();
  });
  it('confirmed bookings conflict too', () => {
    expect(findSameDayConflict([mk({ status: 'confirmed' })], mk())?.id).toBe('b1');
  });
});
