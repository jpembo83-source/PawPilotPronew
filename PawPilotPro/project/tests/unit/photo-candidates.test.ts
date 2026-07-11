// photo_candidates: the assign-at-approval roster and pet resolution.
import { describe, it, expect } from 'vitest';

import {
  candidatesFromBookings,
  searchPetCandidates,
  resolvePetById,
} from '../../supabase/functions/server/lib/photo_candidates.ts';

const booking = (over: Record<string, unknown> = {}) => ({
  pet_id: 'p1', pet_name: 'Rex', household_id: 'hh1',
  booking_date: '2026-07-11', check_in_status: 'checked_in',
  location_id: 'loc-1', pet_photo_url: 'pet-photos/t1/p1.jpg',
  ...over,
});

describe('candidatesFromBookings', () => {
  it('returns only dogs CHECKED IN at the location on the date, deduped and sorted', () => {
    const candidates = candidatesFromBookings([
      booking(),
      booking(), // duplicate booking for the same dog
      booking({ pet_id: 'p2', pet_name: 'Bella' }),
      booking({ pet_id: 'p3', pet_name: 'Zed', check_in_status: 'not_checked_in' }), // not in yet
      booking({ pet_id: 'p4', pet_name: 'Ace', location_id: 'loc-2' }),              // other site
      booking({ pet_id: 'p5', pet_name: 'Moe', booking_date: '2026-07-10' }),        // other day
      null, 'garbage',
    ], { date: '2026-07-11', locationId: 'loc-1' });

    expect(candidates.map(c => c.pet_name)).toEqual(['Bella', 'Rex']);
    expect(candidates.every(c => c.source === 'checked_in')).toBe(true);
    expect(candidates.find(c => c.pet_id === 'p1')?.household_id).toBe('hh1');
  });

  it('accepts the legacy `date` field and skips location filtering for ALL', () => {
    const candidates = candidatesFromBookings([
      booking({ booking_date: undefined, date: '2026-07-11', location_id: 'loc-9' }),
    ], { date: '2026-07-11', locationId: 'ALL' });
    expect(candidates).toHaveLength(1);
  });
});

describe('searchPetCandidates', () => {
  const pets = [
    { id: 'p1', name: 'Rex', household_id: 'hh1', photo_path: 'pet-photos/t1/p1.jpg', active: true },
    { id: 'p2', name: 'T-Rex Junior', household_id: 'hh2', active: false },
    { id: 'p3', name: 'Bella', household_id: 'hh3' },
  ];

  it('matches case-insensitively, ranks active pets first', () => {
    const results = searchPetCandidates(pets, 'rex');
    expect(results.map(r => r.pet_id)).toEqual(['p1', 'p2']); // active Rex before inactive T-Rex
    expect(results[0].source).toBe('search');
  });

  it('empty query matches nothing; limit is respected', () => {
    expect(searchPetCandidates(pets, '   ')).toEqual([]);
    expect(searchPetCandidates(pets, 'e', 1)).toHaveLength(1);
  });
});

describe('resolvePetById', () => {
  it('resolves name + household from the record, never the caller', () => {
    const resolved = resolvePetById(
      [{ id: 'p1', name: 'Rex', household_id: 'hh1' }],
      'p1',
    );
    expect(resolved).toEqual({ petId: 'p1', petName: 'Rex', householdId: 'hh1' });
    expect(resolvePetById([], 'missing')).toBeNull();
  });
});
