// petFlagToggle: the pure derivation behind boolean flag tick-boxes on the
// pet profile (needs_diaper): tick state + which flag API call a flip needs.
import { describe, it, expect } from 'vitest';
import {
  derivePetFlagToggle,
  findPetFlag,
  isPetFlagActive,
} from '../../src/app/modules/customers/petFlagToggle';
import type { HouseholdFlag } from '../../src/app/modules/customers/types';

const flag = (overrides: Partial<HouseholdFlag> = {}): HouseholdFlag => ({
  id: 'flag-1',
  tenant_id: 't1',
  household_id: 'hh-1',
  pet_id: 'pet-1',
  flag_key: 'needs_diaper',
  severity: 'info',
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  ...overrides,
});

describe('isPetFlagActive (the box reflects existing state)', () => {
  it('ticked when an active pet-scoped flag exists', () => {
    expect(isPetFlagActive([flag()], 'pet-1', 'needs_diaper')).toBe(true);
  });

  it('unticked with no flags, an inactive flag, or a different key', () => {
    expect(isPetFlagActive([], 'pet-1', 'needs_diaper')).toBe(false);
    expect(isPetFlagActive([flag({ is_active: false })], 'pet-1', 'needs_diaper')).toBe(false);
    expect(isPetFlagActive([flag({ flag_key: 'vip' })], 'pet-1', 'needs_diaper')).toBe(false);
  });

  it("another pet's flag does not tick this pet's box", () => {
    expect(isPetFlagActive([flag({ pet_id: 'pet-2' })], 'pet-1', 'needs_diaper')).toBe(false);
  });

  it('household-wide flags (no pet_id) do not drive the pet toggle', () => {
    expect(isPetFlagActive([flag({ pet_id: undefined })], 'pet-1', 'needs_diaper')).toBe(false);
  });
});

describe('derivePetFlagToggle', () => {
  it('ticking with no existing record creates the flag', () => {
    expect(derivePetFlagToggle([], 'pet-1', 'needs_diaper', true)).toEqual({ type: 'create' });
  });

  it('ticking with an inactive record reactivates it instead of duplicating', () => {
    expect(
      derivePetFlagToggle([flag({ is_active: false })], 'pet-1', 'needs_diaper', true),
    ).toEqual({ type: 'activate', flagId: 'flag-1' });
  });

  it('reactivates the most recently updated inactive record', () => {
    const older = flag({ id: 'flag-old', is_active: false, updated_at: '2026-06-01T00:00:00Z' });
    const newer = flag({ id: 'flag-new', is_active: false, updated_at: '2026-07-01T00:00:00Z' });
    expect(derivePetFlagToggle([older, newer], 'pet-1', 'needs_diaper', true)).toEqual({
      type: 'activate',
      flagId: 'flag-new',
    });
  });

  it('ticking an already-active flag is a no-op', () => {
    expect(derivePetFlagToggle([flag()], 'pet-1', 'needs_diaper', true)).toEqual({ type: 'none' });
  });

  it('unticking an active flag deactivates that record', () => {
    expect(derivePetFlagToggle([flag()], 'pet-1', 'needs_diaper', false)).toEqual({
      type: 'deactivate',
      flagId: 'flag-1',
    });
  });

  it('unticking with no record (or already inactive) is a no-op', () => {
    expect(derivePetFlagToggle([], 'pet-1', 'needs_diaper', false)).toEqual({ type: 'none' });
    expect(
      derivePetFlagToggle([flag({ is_active: false })], 'pet-1', 'needs_diaper', false),
    ).toEqual({ type: 'none' });
  });

  it("only this pet's records are considered", () => {
    const otherPet = flag({ pet_id: 'pet-2' });
    expect(derivePetFlagToggle([otherPet], 'pet-1', 'needs_diaper', true)).toEqual({ type: 'create' });
    expect(derivePetFlagToggle([otherPet], 'pet-1', 'needs_diaper', false)).toEqual({ type: 'none' });
  });
});

describe('findPetFlag', () => {
  it('prefers the active record over inactive ones', () => {
    const inactive = flag({ id: 'flag-inactive', is_active: false });
    const active = flag({ id: 'flag-active' });
    expect(findPetFlag([inactive, active], 'pet-1', 'needs_diaper')?.id).toBe('flag-active');
  });
});
