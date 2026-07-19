import { describe, it, expect } from 'vitest';
import {
  movePetToHousehold,
  petScopedFlags,
  moveFlagToHousehold,
  petScopedDocuments,
  moveDocumentToHousehold,
  upcomingDaycareBookings,
  repointBookingHousehold,
  activeOvernightReservations,
  repointReservationHousehold,
  upcomingGroomingAppointments,
  repointGroomingHousehold,
} from '../../supabase/functions/server/lib/pet_transfer.ts';

const NOW = '2026-07-19T12:00:00.000Z';
const TODAY = '2026-07-19';

describe('movePetToHousehold', () => {
  it('rewrites household_id and stamps updated_at, keeping everything else', () => {
    const pet = { id: 'p1', household_id: 'old', name: 'Max', behaviour_notes: 'reactive', created_at: 'x' };
    const moved = movePetToHousehold(pet, 'new', NOW);
    expect(moved.household_id).toBe('new');
    expect(moved.updated_at).toBe(NOW);
    expect(moved.behaviour_notes).toBe('reactive');
    expect(moved.created_at).toBe('x');
    // pet id is stable — pet-keyed history (vaccinations, updates) follows free
    expect(moved.id).toBe('p1');
  });
});

describe('flags', () => {
  const flags = [
    { id: 'f1', flag_key: 'behaviour_caution', pet_id: 'p1', household_id: 'old' },
    { id: 'f2', flag_key: 'payment_hold', pet_id: null, household_id: 'old' },
    { id: 'f3', flag_key: 'medical_caution', pet_id: 'p2', household_id: 'old' },
  ];
  it('moves only flags scoped to the transferring pet', () => {
    expect(petScopedFlags(flags, 'p1').map(f => f.id)).toEqual(['f1']);
  });
  it('household-wide flags (payment_hold) stay with the old family', () => {
    expect(petScopedFlags(flags, 'p1').some(f => f.flag_key === 'payment_hold')).toBe(false);
  });
  it('moveFlagToHousehold rewrites household_id', () => {
    const moved = moveFlagToHousehold(flags[0], 'new', NOW);
    expect(moved.household_id).toBe('new');
    expect(moved.flag_key).toBe('behaviour_caution');
  });
});

describe('documents', () => {
  const docs = [
    { id: 'd1', pet_id: 'p1', household_id: 'old', document_type: 'vaccination_cert' },
    { id: 'd2', pet_id: undefined, household_id: 'old', document_type: 'waiver' },
  ];
  it('moves pet-scoped documents, leaves household documents (waiver)', () => {
    expect(petScopedDocuments(docs, 'p1').map(d => d.id)).toEqual(['d1']);
  });
  it('moveDocumentToHousehold rewrites household_id', () => {
    expect(moveDocumentToHousehold(docs[0], 'new').household_id).toBe('new');
  });
});

describe('daycare bookings', () => {
  const bookings = [
    { id: 'b-past', pet_id: 'p1', booking_date: '2026-07-10', booking_status: 'confirmed', household_id: 'old' },
    { id: 'b-today', pet_id: 'p1', booking_date: '2026-07-19', booking_status: 'confirmed', household_id: 'old' },
    { id: 'b-future', pet_id: 'p1', booking_date: '2026-07-25', booking_status: 'confirmed', household_id: 'old' },
    { id: 'b-cancelled', pet_id: 'p1', booking_date: '2026-07-25', booking_status: 'cancelled', household_id: 'old' },
    { id: 'b-other-pet', pet_id: 'p2', booking_date: '2026-07-25', booking_status: 'confirmed', household_id: 'old' },
  ];
  it('selects only this pet\'s active bookings from today onward', () => {
    expect(upcomingDaycareBookings(bookings, 'p1', TODAY).map(b => b.id)).toEqual(['b-today', 'b-future']);
  });
  it('past bookings stay with the old family (their history and billing)', () => {
    expect(upcomingDaycareBookings(bookings, 'p1', TODAY).some(b => b.id === 'b-past')).toBe(false);
  });
  it('repoints household id and name', () => {
    const moved = repointBookingHousehold(bookings[2], 'new', 'The New Family', NOW);
    expect(moved.household_id).toBe('new');
    expect(moved.household_name).toBe('The New Family');
  });
});

describe('overnight reservations', () => {
  const reservations = [
    { id: 'r-ended', petId: 'p1', endDate: '2026-07-17', status: 'confirmed', householdId: 'old', customerId: 'old' },
    { id: 'r-instay', petId: 'p1', endDate: '2026-07-22', status: 'in_stay', householdId: 'old', customerId: 'old' },
    { id: 'r-future', petId: 'p1', endDate: '2026-07-30', status: 'confirmed', householdId: 'old', customerId: 'old' },
    { id: 'r-cancelled', petId: 'p1', endDate: '2026-07-30', status: 'cancelled', householdId: 'old', customerId: 'old' },
  ];
  it('selects active stays that have not ended (incl. in-stay)', () => {
    expect(activeOvernightReservations(reservations, 'p1', TODAY).map(r => r.id)).toEqual(['r-instay', 'r-future']);
  });
  it('repoints householdId AND customerId (both reference the household)', () => {
    const moved = repointReservationHousehold(reservations[2], 'new', NOW);
    expect(moved.householdId).toBe('new');
    expect(moved.customerId).toBe('new');
  });
});

describe('grooming appointments', () => {
  const appointments = [
    { id: 'g-past', pet_id: 'p1', appointment_date: '2026-07-15', status: 'completed', household_id: 'old' },
    { id: 'g-future', pet_id: 'p1', appointment_date: '2026-07-21', status: 'confirmed', household_id: 'old' },
    { id: 'g-cancelled', pet_id: 'p1', appointment_date: '2026-07-21', status: 'cancelled', household_id: 'old' },
  ];
  it('selects upcoming non-cancelled appointments', () => {
    expect(upcomingGroomingAppointments(appointments, 'p1', TODAY).map(a => a.id)).toEqual(['g-future']);
  });
  it('repoints household id and name', () => {
    const moved = repointGroomingHousehold(appointments[1], 'new', 'The New Family', NOW);
    expect(moved.household_id).toBe('new');
    expect(moved.household_name).toBe('The New Family');
  });
});
