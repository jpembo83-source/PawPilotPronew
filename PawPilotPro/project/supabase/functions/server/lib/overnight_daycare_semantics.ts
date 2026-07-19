// Overnight "morning after final night is a daycare day" — pure semantics,
// so they unit-test without Deno or Supabase (convention of
// overnight_semantics.ts / daycare_dedup.ts). The kv-backed applier lives in
// overnight_daycare_link.ts.
//
// The final night of a stay is endDate-1 → the morning after it IS the
// check-out date, so the linked daycare booking lands on reservation.endDate.

import { findDuplicateBooking, type DedupBooking } from "./daycare_dedup.ts";

export type MorningDaycareChoice = "full" | "half";

/** Same canonical service ids / names / windows the staff daycare dialog
 * books (CreateBookingDialog SERVICE_OPTIONS) — the check-out morning maps to
 * the AM half-day. Fallback prices mirror the published MDC rates used when
 * the pricing:service record is absent. */
export const MORNING_DAYCARE_SERVICES: Record<
  MorningDaycareChoice,
  {
    serviceId: string;
    serviceName: string;
    serviceType: string;
    start: string;
    end: string;
    fallbackPrice: number;
  }
> = {
  full: {
    serviceId: "service-daycare-full",
    serviceName: "Daycare (Full Day)",
    serviceType: "full_day",
    start: "07:00",
    end: "18:00",
    fallbackPrice: 99,
  },
  half: {
    serviceId: "service-daycare-half-am",
    serviceName: "Daycare (Half Day AM)",
    serviceType: "half_day_am",
    start: "07:00",
    end: "13:00",
    fallbackPrice: 69,
  },
};

/** The daycare date for a stay: the morning after the final night. */
export function morningAfterDate(reservation: { endDate: string }): string {
  return reservation.endDate;
}

/** Subset of the daycare capacity record the decision needs. */
export interface DaycareCapacityLike {
  max_capacity?: number;
  current_bookings?: number;
}

export type MorningDaycareDecision =
  | { outcome: "create" }
  | { outcome: "skip_duplicate"; existingBookingId?: string; warning: string }
  | { outcome: "skip_full"; warning: string };

/**
 * Whether the linked booking should be created, given the live daycare
 * bookings and the day's capacity record. Duplicate wins over capacity: an
 * existing booking that morning means the dog is already covered, which is
 * information, not an error. A full day never fails the overnight create —
 * it skips the daycare leg with a warning staff can act on.
 */
export function decideMorningDaycare(opts: {
  existingBookings: DedupBooking[];
  capacity: DaycareCapacityLike | null;
  petId: string;
  petName: string;
  locationId: string;
  date: string;
  choice: MorningDaycareChoice;
}): MorningDaycareDecision {
  const { existingBookings, capacity, petId, petName, locationId, date, choice } = opts;
  const svc = MORNING_DAYCARE_SERVICES[choice];

  const duplicate = findDuplicateBooking(existingBookings, {
    pet_id: petId,
    location_id: locationId,
    booking_date: date,
    planned_start_time: svc.start,
    planned_end_time: svc.end,
  });
  if (duplicate) {
    return {
      outcome: "skip_duplicate",
      existingBookingId: duplicate.id,
      warning: `${petName} already has a daycare booking on ${date} — the check-out morning was not booked again.`,
    };
  }

  const max = capacity?.max_capacity;
  const current = capacity?.current_bookings ?? 0;
  if (typeof max === "number" && max > 0 && current >= max) {
    return {
      outcome: "skip_full",
      warning: `Daycare is full on ${date} — the check-out morning was not booked. Book manually with a capacity override if needed.`,
    };
  }

  return { outcome: "create" };
}
