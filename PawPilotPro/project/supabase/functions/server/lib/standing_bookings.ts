// Standing (recurring) daycare bookings — pure planning logic, no I/O, so the
// occurrence maths unit-tests without Deno or Supabase (same pattern as
// daycare_dedup.ts). The route file (daycare_standing_routes.tsx) owns all
// KV reads/writes and calls planOccurrences to decide WHAT to generate.
//
// Weekday numbering and the session catalogue mirror the client source of
// truth in src/app/modules/daycare/lib/multiDayBooking.ts (keep in sync —
// the edge function cannot import Vite-world modules).

/** 0 = Sunday … 6 = Saturday, matching Date.getUTCDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A bookable daycare day: full day or one of the two half-day windows. */
export type DaycareSession = 'full_day' | 'half_day_am' | 'half_day_pm';

export const SESSION_DETAILS: Record<
  DaycareSession,
  { label: string; start: string; end: string; serviceId: string; serviceName: string }
> = {
  full_day: {
    label: 'Full Day',
    start: '07:00',
    end: '18:00',
    serviceId: 'service-daycare-full',
    serviceName: 'Daycare (Full Day)',
  },
  half_day_am: {
    label: 'Half Day (AM)',
    start: '07:00',
    end: '13:00',
    serviceId: 'service-daycare-half-am',
    serviceName: 'Daycare (Half Day AM)',
  },
  half_day_pm: {
    label: 'Half Day (PM)',
    start: '13:00',
    end: '18:00',
    serviceId: 'service-daycare-half-pm',
    serviceName: 'Daycare (Half Day PM)',
  },
};

export function isDaycareSession(value: unknown): value is DaycareSession {
  return value === 'full_day' || value === 'half_day_am' || value === 'half_day_pm';
}

/**
 * A dog's weekly pattern, entered once: which weekdays it attends and which
 * session each of those days is. Persisted at
 * `daycare:standing:schedule:{id}`; concrete bookings are generated from it
 * for a rolling horizon and staff only record exceptions.
 */
export interface StandingBooking {
  id: string;
  tenant_id: string;
  household_id: string;
  household_name: string;
  pet_id: string;
  pet_name: string;
  location_id: string;
  location_name: string;
  /** Weekday → session for that day, e.g. {1:'full_day',3:'full_day',5:'half_day_am'}. */
  days: Partial<Record<Weekday, DaycareSession>>;
  /** 'membership' asks the server to cover each occurrence from the household's
   *  plan (with the same server-verified PAYG fallback as a dialog booking). */
  billing_type: 'membership' | 'payg';
  start_date: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD, inclusive; open-ended when absent
  active: boolean;
  notes?: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * A per-occurrence deviation from the pattern. Skips and overrides never touch
 * the schedule itself, so removing the exception restores the pattern.
 * Persisted at `daycare:standing:exception:{scheduleId}:{date}`.
 */
export interface StandingException {
  standing_booking_id: string;
  date: string; // YYYY-MM-DD
  type: 'skip' | 'override';
  /** Override only: the session replacing the pattern's for this date. */
  session?: DaycareSession;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
}

/**
 * Idempotency marker: this schedule+date has been dealt with (a booking was
 * generated, or a manual booking already covered it). Its presence means the
 * generator must never touch the date again — which is also what makes a
 * schedule edit apply only to future, not-yet-generated dates. Persisted at
 * `daycare:standing:occ:{scheduleId}:{date}`.
 */
export interface StandingOccurrenceMarker {
  standing_booking_id: string;
  date: string;
  booking_id?: string;
  /** 'generated' | 'already_booked' (a manual booking existed for the date). */
  reason: 'generated' | 'already_booked';
  generated_at: string;
}

/** Parse a YYYY-MM-DD string as a UTC calendar date (no timezone drift). */
function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** The session the pattern (plus any exception) wants on `date`, or null when
 *  the dog is not expected that day (not a pattern day, out of bounds, or
 *  skipped). Pure per-date resolution shared by planning and reconciling. */
export function sessionForDate(
  schedule: Pick<StandingBooking, 'days' | 'start_date' | 'end_date'>,
  date: string,
  exception?: Pick<StandingException, 'type' | 'session'> | null,
): DaycareSession | null {
  const parsed = parseISODate(date);
  if (!parsed) return null;
  if (date < schedule.start_date) return null;
  if (schedule.end_date && date > schedule.end_date) return null;
  const patternSession = schedule.days[parsed.getUTCDay() as Weekday];
  if (exception?.type === 'skip') return null;
  if (exception?.type === 'override' && isDaycareSession(exception.session)) {
    return exception.session;
  }
  return patternSession ?? null;
}

export interface PlannedOccurrence {
  date: string; // YYYY-MM-DD
  session: DaycareSession;
}

/**
 * The concrete occurrences the generator should create for `schedule` in the
 * window [from, to] (inclusive), given the per-date exceptions and the set of
 * dates already handled (occurrence markers). Idempotent by construction:
 * handled dates are never returned, so re-running generation — or running it
 * after a schedule edit — only ever yields new, untouched dates.
 * Returns [] for an inactive schedule or a malformed window. Capped at
 * `maxDays` dates scanned so a bad window can't fan out unbounded.
 */
export function planOccurrences(
  schedule: StandingBooking,
  opts: {
    from: string;
    to: string;
    exceptions?: ReadonlyMap<string, Pick<StandingException, 'type' | 'session'>>;
    alreadyHandled?: ReadonlySet<string>;
    maxDays?: number;
  },
): PlannedOccurrence[] {
  if (!schedule.active) return [];
  const fromDate = parseISODate(opts.from);
  const toDate = parseISODate(opts.to);
  if (!fromDate || !toDate) return [];
  if (toDate.getTime() < fromDate.getTime()) return [];

  const maxDays = opts.maxDays ?? 366;
  const out: PlannedOccurrence[] = [];
  const cursor = new Date(fromDate.getTime());
  let guard = 0;
  while (cursor.getTime() <= toDate.getTime() && guard < maxDays) {
    const date = toISODate(cursor);
    if (!opts.alreadyHandled?.has(date)) {
      const session = sessionForDate(schedule, date, opts.exceptions?.get(date) ?? null);
      if (session) out.push({ date, session });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}

/** Validates a client-supplied days map; returns the typed map or null. */
export function parseDaysMap(
  value: unknown,
): Partial<Record<Weekday, DaycareSession>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Partial<Record<Weekday, DaycareSession>> = {};
  for (const [key, session] of Object.entries(value as Record<string, unknown>)) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 0 || day > 6) return null;
    if (!isDaycareSession(session)) return null;
    out[day as Weekday] = session;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** True for a well-formed YYYY-MM-DD calendar date. */
export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && parseISODate(value) !== null;
}
