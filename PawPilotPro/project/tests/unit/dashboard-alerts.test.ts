import { describe, it, expect } from 'vitest';
import {
  countBehaviourMedicalAlerts,
  type AlertBooking,
  type LivePetNotes,
  type FlagLite,
} from '../../supabase/functions/server/lib/dashboard_alerts.ts';

const petMap = (entries: Record<string, LivePetNotes>) =>
  new Map<string, LivePetNotes | undefined>(Object.entries(entries));
const flagMap = (entries: Record<string, FlagLite[]>) =>
  new Map<string, unknown[]>(Object.entries(entries)) as Map<string, FlagLite[]>;

describe('countBehaviourMedicalAlerts', () => {
  it('counts an active behaviour_caution flag even when the booking snapshot has no flag', () => {
    // The reported bug: dog booked in, behaviour flag added on the profile,
    // booking.has_behaviour_flag is false, dashboard showed 0.
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1', has_behaviour_flag: false },
    ];
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: true, pet_id: 'p1' }],
    });
    expect(countBehaviourMedicalAlerts(bookings, petMap({ p1: {} }), flags)).toEqual({
      behaviour_flags: 1,
      medical_flags: 0,
    });
  });

  it('counts a medical_caution flag under medical', () => {
    const bookings: AlertBooking[] = [{ pet_id: 'p1', household_id: 'h1' }];
    const flags = flagMap({
      h1: [{ flag_key: 'medical_caution', is_active: true, pet_id: 'p1' }],
    });
    expect(countBehaviourMedicalAlerts(bookings, petMap({ p1: {} }), flags)).toEqual({
      behaviour_flags: 0,
      medical_flags: 1,
    });
  });

  it('a household-wide flag (pet_id null) applies to every pet in that household', () => {
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1' },
      { pet_id: 'p2', household_id: 'h1' },
    ];
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: true, pet_id: null }],
    });
    expect(countBehaviourMedicalAlerts(bookings, petMap({ p1: {}, p2: {} }), flags).behaviour_flags).toBe(2);
  });

  it('a pet-scoped flag does not leak to other pets', () => {
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1' },
      { pet_id: 'p2', household_id: 'h1' },
    ];
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: true, pet_id: 'p1' }],
    });
    expect(countBehaviourMedicalAlerts(bookings, petMap({ p1: {}, p2: {} }), flags).behaviour_flags).toBe(1);
  });

  it('an inactive flag never counts', () => {
    const bookings: AlertBooking[] = [{ pet_id: 'p1', household_id: 'h1' }];
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: false, pet_id: 'p1' }],
    });
    expect(countBehaviourMedicalAlerts(bookings, petMap({ p1: {} }), flags).behaviour_flags).toBe(0);
  });

  it('counts live pet notes even with no flag', () => {
    const bookings: AlertBooking[] = [{ pet_id: 'p1', household_id: 'h1' }];
    expect(
      countBehaviourMedicalAlerts(
        bookings,
        petMap({ p1: { behaviour_notes: 'bites strangers', medical_notes: 'epilepsy' } }),
        flagMap({}),
      ),
    ).toEqual({ behaviour_flags: 1, medical_flags: 1 });
  });

  it('live notes cleared on the pet override a stale booking snapshot', () => {
    // Booking was stamped has_behaviour_flag=true, but the note was since
    // removed on the live pet — the alert should clear.
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1', has_behaviour_flag: true },
    ];
    expect(
      countBehaviourMedicalAlerts(bookings, petMap({ p1: { behaviour_notes: '' } }), flagMap({})).behaviour_flags,
    ).toBe(0);
  });

  it('falls back to the booking snapshot when the live pet record is gone', () => {
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1', has_behaviour_flag: true, has_medical_flag: true },
    ];
    // pet not in the live map (deleted) → fail towards showing.
    expect(countBehaviourMedicalAlerts(bookings, petMap({}), flagMap({}))).toEqual({
      behaviour_flags: 1,
      medical_flags: 1,
    });
  });

  it('does not double-count a dog that has both a flag and a note', () => {
    const bookings: AlertBooking[] = [{ pet_id: 'p1', household_id: 'h1' }];
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: true, pet_id: 'p1' }],
    });
    expect(
      countBehaviourMedicalAlerts(bookings, petMap({ p1: { behaviour_notes: 'reactive' } }), flags).behaviour_flags,
    ).toBe(1);
  });

  it('unrelated flag keys (vip, payment_hold) do not count as behaviour/medical', () => {
    const bookings: AlertBooking[] = [{ pet_id: 'p1', household_id: 'h1' }];
    const flags = flagMap({
      h1: [
        { flag_key: 'vip', is_active: true, pet_id: null },
        { flag_key: 'payment_hold', is_active: true, pet_id: null },
      ],
    });
    expect(countBehaviourMedicalAlerts(bookings, petMap({ p1: {} }), flags)).toEqual({
      behaviour_flags: 0,
      medical_flags: 0,
    });
  });

  it('returns zero for no bookings', () => {
    expect(countBehaviourMedicalAlerts([], petMap({}), flagMap({}))).toEqual({
      behaviour_flags: 0,
      medical_flags: 0,
    });
  });
});
