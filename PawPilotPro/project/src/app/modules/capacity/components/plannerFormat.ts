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
    case 'half_day': {
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
