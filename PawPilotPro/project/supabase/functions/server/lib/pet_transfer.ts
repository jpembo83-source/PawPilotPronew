// Pet transfer ("dog adopted by a new family") — pure helpers, so the move
// logic unit-tests without Deno or Supabase.
//
// A pet's identity (pet id) is stable across the transfer, so records keyed by
// pet id alone (vaccinations, pet updates) follow the dog automatically. What
// this module computes is everything that must be REWRITTEN because it embeds
// the household:
//   - the pet record itself (household_id lives in both the KV key and value),
//   - pet-scoped operational flags (bite history etc. must follow the dog;
//     household-wide flags like payment_hold stay with the old family),
//   - pet-scoped documents (vaccination certs travel; household waivers stay),
//   - FUTURE service records (daycare bookings, overnight reservations,
//     grooming appointments): several routes resolve the pet at
//     `customer:{tenant}:pet:{record.household_id}:{pet_id}`, so a stale
//     household id would break those lookups outright. Past/finished records
//     are deliberately left with the old family — that history (and its
//     billing) happened under them.

const INACTIVE_BOOKING_STATUSES = new Set(['cancelled', 'no_show', 'declined']);
const INACTIVE_RESERVATION_STATUSES = new Set(['cancelled', 'no_show']);

export interface TransferPet {
  id?: string;
  household_id?: string;
  name?: string;
  [k: string]: unknown;
}

/** The pet record as it should exist under the new household. */
export function movePetToHousehold<T extends TransferPet>(
  pet: T,
  toHouseholdId: string,
  now: string,
): T & { household_id: string; updated_at: string } {
  return { ...pet, household_id: toHouseholdId, updated_at: now };
}

export interface TransferFlag {
  id?: string;
  pet_id?: unknown;
  household_id?: string;
  flag_key?: unknown;
  [k: string]: unknown;
}

/** Flags that follow the dog: pet-scoped to THIS pet. Household-wide stay. */
export function petScopedFlags<T extends TransferFlag>(flags: T[], petId: string): T[] {
  return flags.filter(
    (f) => f && typeof f.flag_key === 'string' && typeof f.pet_id === 'string' && f.pet_id === petId,
  );
}

export function moveFlagToHousehold<T extends TransferFlag>(
  flag: T,
  toHouseholdId: string,
  now: string,
): T & { household_id: string; updated_at: string } {
  return { ...flag, household_id: toHouseholdId, updated_at: now };
}

export interface TransferDocument {
  id?: string;
  pet_id?: unknown;
  household_id?: string;
  [k: string]: unknown;
}

/** Documents that follow the dog: ones tied to THIS pet (vax certs etc.). */
export function petScopedDocuments<T extends TransferDocument>(docs: T[], petId: string): T[] {
  return docs.filter((d) => d && typeof d.pet_id === 'string' && d.pet_id === petId);
}

export function moveDocumentToHousehold<T extends TransferDocument>(
  doc: T,
  toHouseholdId: string,
): T & { household_id: string } {
  return { ...doc, household_id: toHouseholdId };
}

export interface TransferBooking {
  pet_id?: string;
  booking_date?: string;
  booking_status?: string;
  household_id?: string;
  household_name?: string;
  [k: string]: unknown;
}

/** Daycare bookings that must move: this pet, today or later, still active. */
export function upcomingDaycareBookings<T extends TransferBooking>(
  bookings: T[],
  petId: string,
  today: string,
): T[] {
  return bookings.filter(
    (b) =>
      b &&
      b.pet_id === petId &&
      typeof b.booking_date === 'string' &&
      b.booking_date >= today &&
      !INACTIVE_BOOKING_STATUSES.has(b.booking_status ?? ''),
  );
}

export function repointBookingHousehold<T extends TransferBooking>(
  booking: T,
  toHouseholdId: string,
  toHouseholdName: string,
  now: string,
): T & { household_id: string; household_name: string; updated_at: string } {
  return { ...booking, household_id: toHouseholdId, household_name: toHouseholdName, updated_at: now };
}

export interface TransferReservation {
  petId?: string;
  endDate?: string;
  status?: string;
  householdId?: string;
  customerId?: string;
  [k: string]: unknown;
}

/** Overnight reservations that must move: this pet, not yet ended, active. */
export function activeOvernightReservations<T extends TransferReservation>(
  reservations: T[],
  petId: string,
  today: string,
): T[] {
  return reservations.filter(
    (r) =>
      r &&
      r.petId === petId &&
      typeof r.endDate === 'string' &&
      r.endDate >= today &&
      !INACTIVE_RESERVATION_STATUSES.has(r.status ?? ''),
  );
}

export function repointReservationHousehold<T extends TransferReservation>(
  reservation: T,
  toHouseholdId: string,
  now: string,
): T & { householdId: string; customerId: string; updatedAt: string } {
  return {
    ...reservation,
    householdId: toHouseholdId,
    customerId: toHouseholdId,
    updatedAt: now,
  };
}

export interface TransferGroomingAppointment {
  pet_id?: string;
  appointment_date?: string;
  status?: string;
  household_id?: string;
  household_name?: string;
  [k: string]: unknown;
}

/** Grooming appointments that must move: this pet, today or later, active. */
export function upcomingGroomingAppointments<T extends TransferGroomingAppointment>(
  appointments: T[],
  petId: string,
  today: string,
): T[] {
  return appointments.filter(
    (a) =>
      a &&
      a.pet_id === petId &&
      typeof a.appointment_date === 'string' &&
      a.appointment_date >= today &&
      a.status !== 'cancelled',
  );
}

export function repointGroomingHousehold<T extends TransferGroomingAppointment>(
  appointment: T,
  toHouseholdId: string,
  toHouseholdName: string,
  now: string,
): T & { household_id: string; household_name: string; updated_at: string } {
  return {
    ...appointment,
    household_id: toHouseholdId,
    household_name: toHouseholdName,
    updated_at: now,
  };
}
