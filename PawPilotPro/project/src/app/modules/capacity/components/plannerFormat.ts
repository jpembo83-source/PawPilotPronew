// Planner annotations — the digital shorthand of the paper register
// ("Roxy Full + PU/DO", "Rosie ½ AM", struck-through cancellations).
import type { PlannerBooking } from '../types';

export function isCancelled(b: PlannerBooking): boolean {
  return b.booking_status === 'cancelled' || b.booking_status === 'no_show';
}

export function isActive(b: PlannerBooking): boolean {
  return !isCancelled(b);
}

/** "Full", "½ AM", "½ PM", "Trial", "Member" — the register's service shorthand. */
export function serviceShorthand(b: PlannerBooking): string {
  switch (b.service_type) {
    case 'half_day':
    case 'half_day_am':
    case 'half_day_pm': {
      const start = b.planned_start_time ?? '';
      return start && start >= '12:00' ? '½ PM' : '½ AM';
    }
    case 'trial_day':
      return 'Trial';
    case 'hourly':
      return 'Hourly';
    case 'membership':
      return 'Member';
    default:
      return 'Full';
  }
}

export function bookingsForDate(bookings: PlannerBooking[], date: string): PlannerBooking[] {
  return bookings
    .filter((b) => b.booking_date === date)
    .sort((a, b) => {
      // Active before cancelled, then by planned start, then name — the
      // order a register reads in.
      if (isCancelled(a) !== isCancelled(b)) return isCancelled(a) ? 1 : -1;
      const t = (a.planned_start_time ?? '99').localeCompare(b.planned_start_time ?? '99');
      if (t !== 0) return t;
      return a.pet_name.localeCompare(b.pet_name);
    });
}

export function activeCount(bookings: PlannerBooking[], date: string): number {
  return bookings.filter((b) => b.booking_date === date && isActive(b)).length;
}

/** A boarding stay as the planner needs it — a name and an inclusive date span. */
export interface PlannerOvernightStay {
  id: string;
  petId?: string;
  petName: string;
  startDate: string; // YYYY-MM-DD (check-in)
  endDate: string;   // YYYY-MM-DD (check-out)
  status?: string;
}

/**
 * Overnight stays "in" on `date`. Boarding is counted per night, like a hotel:
 * a stay covers check-in through the last night, i.e. the half-open span
 * [startDate, endDate). The check-out day is NOT counted — the dog leaves that
 * morning, so it isn't a full day of on-site care (nor is any day after).
 * Cancelled stays are excluded.
 */
export function overnightStaysForDate(
  stays: PlannerOvernightStay[],
  date: string,
): PlannerOvernightStay[] {
  return stays
    .filter(
      (s) =>
        s.startDate <= date &&
        date < s.endDate &&
        s.status !== 'cancelled',
    )
    .sort((a, b) => a.petName.localeCompare(b.petName));
}

/**
 * Overnight stays for `date` that aren't already represented by a daycare
 * booking for the same dog — so a dog with both an overnight stay and a
 * daycare booking that day (an overnight "converging" to daycare) is shown and
 * counted once, via its daycare line, not twice.
 */
export function overnightOnlyForDate(
  bookings: PlannerBooking[],
  stays: PlannerOvernightStay[],
  date: string,
): PlannerOvernightStay[] {
  const daycarePetIds = new Set(
    bookings.filter((b) => b.booking_date === date && isActive(b)).map((b) => b.pet_id),
  );
  return overnightStaysForDate(stays, date).filter(
    (s) => !s.petId || !daycarePetIds.has(s.petId),
  );
}

/**
 * Single-pane on-site count for `date`: unique dogs physically present, whether
 * booked for daycare that day or boarding overnight (a boarding dog is on-site
 * in the daytime too). A dog counted via daycare is not double-counted for its
 * overnight stay.
 */
export function onSiteCount(
  bookings: PlannerBooking[],
  stays: PlannerOvernightStay[],
  date: string,
): number {
  return activeCount(bookings, date) + overnightOnlyForDate(bookings, stays, date).length;
}
