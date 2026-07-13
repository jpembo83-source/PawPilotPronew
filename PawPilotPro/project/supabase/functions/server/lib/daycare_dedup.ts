// Same-day duplicate guard for daycare bookings — pure, so it unit-tests
// without Deno or Supabase. A dog can't be booked twice for the SAME location,
// SAME date, with an OVERLAPPING time window (two full days, or two identical
// sessions). A morning half-day and an afternoon half-day on the same day do
// NOT overlap and are allowed (they make up a split full day).

/** Minutes since midnight for "HH:mm"; null if unparseable. */
function toMinutes(hhmm: string | undefined | null): number | null {
  if (typeof hhmm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Do two [start, end) time windows overlap? Half-open, so 07:00–13:00 and
 * 13:00–18:00 touch but do not overlap. When either window is missing a time,
 * treat it as a whole-day booking (overlaps anything that day).
 */
export function timeWindowsOverlap(
  aStart: string | undefined | null,
  aEnd: string | undefined | null,
  bStart: string | undefined | null,
  bEnd: string | undefined | null,
): boolean {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  // Missing/'unparseable times → assume full-day presence → always conflicts.
  if (as === null || ae === null || bs === null || be === null) return true;
  return as < be && bs < ae;
}

/** The subset of a booking this guard needs. */
export interface DedupBooking {
  id?: string;
  pet_id?: string;
  location_id?: string;
  booking_date?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  booking_status?: string;
}

/** Statuses that free the slot — a cancelled/no-show booking never conflicts. */
const INACTIVE_STATUSES = new Set(['cancelled', 'no_show', 'declined']);

/**
 * The first existing active booking that duplicates `candidate` — same pet,
 * same location, same date, overlapping time window. Bookings in `excludeIds`
 * (e.g. the one being updated) are skipped. Returns null when there's no clash.
 */
export function findDuplicateBooking(
  existing: DedupBooking[],
  candidate: DedupBooking,
  excludeIds: Set<string> = new Set(),
): DedupBooking | null {
  if (!candidate.pet_id || !candidate.location_id || !candidate.booking_date) return null;
  for (const b of existing) {
    if (b.id && excludeIds.has(b.id)) continue;
    if (INACTIVE_STATUSES.has(b.booking_status ?? '')) continue;
    if (b.pet_id !== candidate.pet_id) continue;
    if (b.location_id !== candidate.location_id) continue;
    if (b.booking_date !== candidate.booking_date) continue;
    if (
      timeWindowsOverlap(
        b.planned_start_time, b.planned_end_time,
        candidate.planned_start_time, candidate.planned_end_time,
      )
    ) {
      return b;
    }
  }
  return null;
}
