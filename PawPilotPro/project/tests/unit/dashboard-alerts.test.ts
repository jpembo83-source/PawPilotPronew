import { describe, it, expect } from 'vitest';
import {
  annotateLiveAlertFlags,
  buildPetNotesMap,
  countBehaviourMedicalAlerts,
  groupFlagsByHousehold,
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

describe('annotateLiveAlertFlags', () => {
  it('flips has_behaviour_flag on for a flag created after booking (the reported bug end-to-end)', () => {
    // The count said 1 but the list filter (b => b.has_behaviour_flag) saw the
    // stale false and showed no dog. Annotated records make the filter match.
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1', has_behaviour_flag: false },
    ];
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: true, pet_id: 'p1', reason: 'Reactive with other dogs' }],
    });
    const [annotated] = annotateLiveAlertFlags(bookings, petMap({ p1: {} }), flags);
    expect(annotated.has_behaviour_flag).toBe(true);
    // Flag-only alert carries the flag's reason as the note, so warnings show WHY.
    expect(annotated.behaviour_notes).toBe('Reactive with other dogs');
  });

  it('prefers live pet notes text over the flag reason', () => {
    const bookings: AlertBooking[] = [{ pet_id: 'p1', household_id: 'h1' }];
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: true, pet_id: 'p1', reason: 'flag reason' }],
    });
    const [annotated] = annotateLiveAlertFlags(
      bookings, petMap({ p1: { behaviour_notes: 'bites strangers' } }), flags,
    );
    expect(annotated.behaviour_notes).toBe('bites strangers');
  });

  it('clears a stale true snapshot when live notes are gone and no flag exists', () => {
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1', has_behaviour_flag: true, behaviour_notes: 'old' },
    ];
    const [annotated] = annotateLiveAlertFlags(bookings, petMap({ p1: { behaviour_notes: '' } }), flagMap({}));
    expect(annotated.has_behaviour_flag).toBe(false);
  });

  it('preserves unrelated booking fields', () => {
    const bookings = [
      { pet_id: 'p1', household_id: 'h1', pet_name: 'Meg', booking_date: '2026-07-19' } as AlertBooking & { pet_name: string },
    ];
    const [annotated] = annotateLiveAlertFlags(bookings, petMap({ p1: {} }), flagMap({}));
    expect(annotated.pet_name).toBe('Meg');
  });

  it('count always equals the number of annotated bookings the list filter matches', () => {
    // The invariant that makes the dashboard chip and the click-through list
    // agree: both derive from the same function.
    const bookings: AlertBooking[] = [
      { pet_id: 'p1', household_id: 'h1', has_behaviour_flag: false },
      { pet_id: 'p2', household_id: 'h1', has_behaviour_flag: true },
      { pet_id: 'p3', household_id: 'h2' },
    ];
    const pets = petMap({ p1: {}, p2: { behaviour_notes: 'nippy' }, p3: {} });
    const flags = flagMap({
      h1: [{ flag_key: 'behaviour_caution', is_active: true, pet_id: 'p1' }],
    });
    const count = countBehaviourMedicalAlerts(bookings, pets, flags).behaviour_flags;
    const listed = annotateLiveAlertFlags(bookings, pets, flags).filter(b => b.has_behaviour_flag).length;
    expect(count).toBe(listed);
    expect(count).toBe(2);
  });
});

describe('kv record grouping helpers', () => {
  it('groupFlagsByHousehold keeps only flag-shaped records from a mixed household prefix scan', () => {
    const records = [
      { id: 'h1', name: 'The Pemberton Household' }, // household record — no flag_key
      { id: 'f1', flag_key: 'behaviour_caution', household_id: 'h1', is_active: true },
      { id: 'f2', flag_key: 'vip', household_id: 'h2', is_active: true },
      null,
      { id: 'f3', flag_key: 'medical_caution' }, // no household_id → dropped
    ];
    const grouped = groupFlagsByHousehold(records);
    expect(grouped.get('h1')).toHaveLength(1);
    expect(grouped.get('h2')).toHaveLength(1);
    expect(grouped.size).toBe(2);
  });

  it('buildPetNotesMap indexes pets by id and skips malformed records', () => {
    const map = buildPetNotesMap([
      { id: 'p1', behaviour_notes: 'reactive', medical_notes: null },
      { name: 'no-id' },
      null,
    ]);
    expect(map.get('p1')?.behaviour_notes).toBe('reactive');
    expect(map.size).toBe(1);
  });
});
