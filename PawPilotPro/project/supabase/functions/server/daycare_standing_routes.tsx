// Standing (recurring) daycare bookings — a dog's weekly pattern entered
// once, generated into concrete daycare bookings for a rolling horizon, with
// per-occurrence exceptions (skip / session override) that never touch the
// series. Mounted at /make-server-fc003b23/daycare-standing.
//
// Generation model: there is no scheduler in this stack (same reasoning as
// the lazy membership renewal in lib/membership_catalog.ts), so generation is
// idempotent and applied on demand — after every schedule/exception change,
// and via POST /generate which the staff app fires when the planner loads.
// An external cron can hit the same endpoint with a staff token if desired.

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';
import {
  createBookingCore,
  cancelBookingCore,
  type DaycareBooking,
} from './daycare_routes.tsx';
import {
  SESSION_DETAILS,
  isDaycareSession,
  isISODate,
  parseDaysMap,
  planOccurrences,
  sessionForDate,
  type DaycareSession,
  type StandingBooking,
  type StandingException,
  type StandingOccurrenceMarker,
} from './lib/standing_bookings.ts';

const app = new Hono();

// Every route requires a validated user (SERVICE_ROLE_KEY validation in the
// shared middleware; see repo auth rules).
app.use('*', requireAuth);

// Same role table as daycare_routes: schedules and their exceptions are the
// front-desk booking workflow, so 'create_booking' (staff and up) governs
// them; viewing needs 'view'.
const hasPermission = (userRole: string, action: string): boolean => {
  const permissions: Record<string, string[]> = {
    admin: ['view', 'create_booking'],
    manager: ['view', 'create_booking'],
    assistant_manager: ['view', 'create_booking'],
    staff: ['view', 'create_booking'],
  };
  return permissions[userRole]?.includes(action) || false;
};

const generateId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/** Cancellation reason stamped by a skip — the client uses it to tell a
 *  skipped occurrence (restorable) from a manually cancelled one. */
export const STANDING_SKIP_REASON = 'Standing schedule: skipped for this day';
const STANDING_OVERRIDE_REASON = 'Standing schedule: session changed for this day';

const scheduleKey = (id: string) => `daycare:standing:schedule:${id}`;
const exceptionKey = (scheduleId: string, date: string) =>
  `daycare:standing:exception:${scheduleId}:${date}`;
const occurrenceKey = (scheduleId: string, date: string) =>
  `daycare:standing:occ:${scheduleId}:${date}`;

/** Rolling generation horizon: today + 4 weeks, clamped to protect the KV. */
const DEFAULT_HORIZON_DAYS = 28;
const MAX_HORIZON_DAYS = 56;

const todayISO = () => new Date().toISOString().split('T')[0];

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

const canAccessLocation = (user: AuthenticatedUser, locationId: string): boolean =>
  user.role === 'admin' ||
  (Array.isArray(user.locationIds) && user.locationIds.includes(locationId));

async function loadSchedule(id: string): Promise<StandingBooking | null> {
  const record = (await kv.get(scheduleKey(id))) as StandingBooking | null;
  return record && record.id ? record : null;
}

async function loadExceptions(
  scheduleId: string,
): Promise<Map<string, StandingException>> {
  const records = (await kv.getByPrefix(
    `daycare:standing:exception:${scheduleId}:`,
  )) as StandingException[];
  const map = new Map<string, StandingException>();
  for (const record of Array.isArray(records) ? records : []) {
    if (record && record.date) map.set(record.date, record);
  }
  return map;
}

async function loadOccurrenceMarkers(
  scheduleId: string,
): Promise<Map<string, StandingOccurrenceMarker>> {
  const records = (await kv.getByPrefix(
    `daycare:standing:occ:${scheduleId}:`,
  )) as StandingOccurrenceMarker[];
  const map = new Map<string, StandingOccurrenceMarker>();
  for (const record of Array.isArray(records) ? records : []) {
    if (record && record.date) map.set(record.date, record);
  }
  return map;
}

interface GenerationSummary {
  created: number;
  already_handled: number;
  /** Capacity-full (or transient-failure) dates that were NOT booked — the
   *  warning surface demanded by "warn, don't silently overbook". These
   *  dates carry no occurrence marker, so a later run retries them. */
  warnings: { standing_booking_id: string; pet_name: string; date: string; reason: string }[];
}

/**
 * Generate concrete bookings for one schedule over [from, to]. Idempotent:
 * every processed date gets an occurrence marker, and marked dates are never
 * touched again (which is also what confines schedule edits to future,
 * not-yet-generated dates). A date already holding a manual booking is
 * marked 'already_booked' — never double-booked. Capacity-full dates are
 * reported as warnings and left unmarked for retry.
 */
async function generateForSchedule(
  user: AuthenticatedUser,
  schedule: StandingBooking,
  from: string,
  to: string,
  summary: GenerationSummary,
): Promise<void> {
  const exceptions = await loadExceptions(schedule.id);
  const markers = await loadOccurrenceMarkers(schedule.id);

  const planned = planOccurrences(schedule, {
    from,
    to,
    exceptions,
    alreadyHandled: new Set(markers.keys()),
  });
  summary.already_handled += markers.size;

  for (const occurrence of planned) {
    const details = SESSION_DETAILS[occurrence.session];
    const result = await createBookingCore(
      user,
      {
        household_id: schedule.household_id,
        pet_id: schedule.pet_id,
        location_id: schedule.location_id,
        location_name: schedule.location_name,
        service_id: details.serviceId,
        service_name: details.serviceName,
        // 'membership' is the same server-verified claim the dialog sends —
        // an uncovered day falls back to PAYG at full price inside the core.
        service_type: schedule.billing_type === 'membership' ? 'membership' : occurrence.session,
        booking_date: occurrence.date,
        planned_start_time: details.start,
        planned_end_time: details.end,
        customer_notes: schedule.notes,
        standing_booking_id: schedule.id,
      },
      // Never silently overbook from the generator, whatever the actor's role.
      { allowCapacityOverride: false },
    );

    if (result.ok) {
      const marker: StandingOccurrenceMarker = {
        standing_booking_id: schedule.id,
        date: occurrence.date,
        booking_id: result.booking.id,
        reason: 'generated',
        generated_at: new Date().toISOString(),
      };
      await kv.set(occurrenceKey(schedule.id, occurrence.date), marker);
      summary.created += 1;
    } else if (result.code === 'duplicate_booking') {
      // A manual booking already covers this date — record it as handled so
      // the pattern never fights the manual entry.
      const marker: StandingOccurrenceMarker = {
        standing_booking_id: schedule.id,
        date: occurrence.date,
        booking_id: result.existingBookingId,
        reason: 'already_booked',
        generated_at: new Date().toISOString(),
      };
      await kv.set(occurrenceKey(schedule.id, occurrence.date), marker);
      summary.already_handled += 1;
    } else {
      // Capacity full or a data problem: warn, leave unmarked so the next
      // run retries (a freed slot then fills automatically).
      summary.warnings.push({
        standing_booking_id: schedule.id,
        pet_name: schedule.pet_name,
        date: occurrence.date,
        reason: result.code === 'capacity_full' ? 'capacity_full' : result.error,
      });
    }
  }
}

/**
 * Bring one date of one schedule in line with the pattern + its exception:
 * cancel a generated booking that should no longer exist (skip, or session
 * changed) and create the one that should. Used by the exception endpoints so
 * a skip/override/restore applies immediately, not on the next generation run.
 */
async function reconcileOccurrence(
  user: AuthenticatedUser,
  schedule: StandingBooking,
  date: string,
  reason: string,
  summary: GenerationSummary,
): Promise<void> {
  if (date < todayISO()) return; // never rewrite the past

  const exceptions = await loadExceptions(schedule.id);
  const desiredSession = schedule.active
    ? sessionForDate(schedule, date, exceptions.get(date) ?? null)
    : null;

  const marker = (await kv.get(occurrenceKey(schedule.id, date))) as
    | StandingOccurrenceMarker
    | null;
  const existing = marker?.booking_id
    ? ((await kv.get(`daycare:booking:${marker.booking_id}`)) as DaycareBooking | null)
    : null;
  const existingActive =
    existing &&
    existing.booking_status !== 'cancelled' &&
    existing.booking_status !== 'completed' &&
    existing.check_in_status === 'not_checked_in';

  const existingSession =
    existingActive && marker?.reason === 'generated'
      ? (Object.keys(SESSION_DETAILS) as DaycareSession[]).find(
          (s) => SESSION_DETAILS[s].serviceId === existing.service_id,
        ) ?? null
      : null;

  // Nothing to change: the active generated booking already has the desired
  // session (or the date was satisfied by a manual booking, which exceptions
  // never touch).
  if (marker?.reason === 'already_booked') return;
  if (existingSession && existingSession === desiredSession) return;

  // Cancel the generated booking that no longer matches.
  if (existingActive && marker?.reason === 'generated') {
    await cancelBookingCore(user, existing.id, reason);
  }

  if (!desiredSession) {
    // Skip (or out of pattern): keep the marker so the generator never
    // recreates the date; the cancelled booking documents the skip.
    if (!marker) {
      await kv.set(occurrenceKey(schedule.id, date), {
        standing_booking_id: schedule.id,
        date,
        reason: 'generated',
        generated_at: new Date().toISOString(),
      } satisfies StandingOccurrenceMarker);
    }
    return;
  }

  // Create the booking the pattern/exception now wants for this date.
  const details = SESSION_DETAILS[desiredSession];
  const result = await createBookingCore(
    user,
    {
      household_id: schedule.household_id,
      pet_id: schedule.pet_id,
      location_id: schedule.location_id,
      location_name: schedule.location_name,
      service_id: details.serviceId,
      service_name: details.serviceName,
      service_type: schedule.billing_type === 'membership' ? 'membership' : desiredSession,
      booking_date: date,
      planned_start_time: details.start,
      planned_end_time: details.end,
      customer_notes: schedule.notes,
      standing_booking_id: schedule.id,
    },
    { allowCapacityOverride: false },
  );

  if (result.ok) {
    await kv.set(occurrenceKey(schedule.id, date), {
      standing_booking_id: schedule.id,
      date,
      booking_id: result.booking.id,
      reason: 'generated',
      generated_at: new Date().toISOString(),
    } satisfies StandingOccurrenceMarker);
    summary.created += 1;
  } else {
    summary.warnings.push({
      standing_booking_id: schedule.id,
      pet_name: schedule.pet_name,
      date,
      reason: result.code === 'capacity_full' ? 'capacity_full' : result.error,
    });
  }
}

// ============================================================================
// ROUTES
// ============================================================================

// List standing schedules (optionally for one pet or household).
app.get('/', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const petId = c.req.query('pet_id');
    const householdId = c.req.query('household_id');

    let schedules = ((await kv.getByPrefix('daycare:standing:schedule:')) as StandingBooking[])
      .filter((s) => s && s.id);
    schedules = schedules.filter((s) => canAccessLocation(user, s.location_id));
    if (petId) schedules = schedules.filter((s) => s.pet_id === petId);
    if (householdId) schedules = schedules.filter((s) => s.household_id === householdId);

    schedules.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    return c.json(schedules);
  } catch (error) {
    return internalError(c, 'daycareStanding.list', error);
  }
});

// List a schedule's exceptions (so the UI can label skipped dates).
app.get('/:id/exceptions', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const schedule = await loadSchedule(c.req.param('id'));
    if (!schedule) return c.json({ error: 'Standing schedule not found' }, 404);
    if (!canAccessLocation(user, schedule.location_id)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const exceptions = await loadExceptions(schedule.id);
    return c.json([...exceptions.values()]);
  } catch (error) {
    return internalError(c, 'daycareStanding.listExceptions', error);
  }
});

// Create a standing schedule and generate its first horizon immediately.
app.post('/', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!hasPermission(user.role, 'create_booking')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }

    const body = await c.req.json();
    const days = parseDaysMap(body.days);
    if (!days) {
      return c.json({ error: 'Pick at least one weekday with a valid session' }, 400);
    }
    if (!body.household_id || !body.pet_id || !body.location_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    if (!isISODate(body.start_date)) {
      return c.json({ error: 'A valid start date is required' }, 400);
    }
    if (body.end_date !== undefined && body.end_date !== null && body.end_date !== '') {
      if (!isISODate(body.end_date) || body.end_date < body.start_date) {
        return c.json({ error: 'End date must be a valid date on or after the start date' }, 400);
      }
    }
    if (body.billing_type !== 'membership' && body.billing_type !== 'payg') {
      return c.json({ error: 'billing_type must be membership or payg' }, 400);
    }
    if (!canAccessLocation(user, body.location_id)) {
      return c.json({ error: 'Access denied to this location' }, 403);
    }

    // Validate the pet/household pair against the live customer records —
    // same source of truth the booking core uses.
    const tenantId = user.tenantId;
    const pet = (await kv.get(
      `customer:${tenantId}:pet:${body.household_id}:${body.pet_id}`,
    )) as { id?: string; name?: string; household_id?: string } | null;
    if (!pet || pet.household_id !== body.household_id) {
      return c.json({ error: 'Pet not found in the selected household' }, 404);
    }
    const households = (await kv.getByPrefix(`customer:${tenantId}:household:`)) as {
      id?: string;
      name?: string;
    }[];
    const household = households.find((h) => h && h.id === body.household_id);
    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }

    // One active schedule per pet+location keeps the model predictable —
    // edit the existing one rather than stacking patterns.
    const existing = ((await kv.getByPrefix('daycare:standing:schedule:')) as StandingBooking[])
      .filter((s) => s && s.id && s.active)
      .find((s) => s.pet_id === body.pet_id && s.location_id === body.location_id);
    if (existing) {
      return c.json(
        { error: `${pet.name || 'This pet'} already has an active standing schedule here — edit it instead.` },
        409,
      );
    }

    const now = new Date().toISOString();
    const schedule: StandingBooking = {
      id: generateId('standing'),
      tenant_id: tenantId,
      household_id: body.household_id,
      household_name: household.name || '',
      pet_id: body.pet_id,
      pet_name: pet.name || '',
      location_id: body.location_id,
      location_name: typeof body.location_name === 'string' ? body.location_name : '',
      days,
      billing_type: body.billing_type,
      start_date: body.start_date,
      end_date: isISODate(body.end_date) ? body.end_date : undefined,
      active: true,
      notes: typeof body.notes === 'string' && body.notes ? body.notes : undefined,
      created_by_id: user.id,
      created_by_name: user.name || user.email || '',
      created_at: now,
      updated_at: now,
    };
    await kv.set(scheduleKey(schedule.id), schedule);

    // First horizon fill, so the planner is populated the moment the pattern
    // is saved.
    const summary: GenerationSummary = { created: 0, already_handled: 0, warnings: [] };
    const from = schedule.start_date > todayISO() ? schedule.start_date : todayISO();
    await generateForSchedule(user, schedule, from, addDaysISO(todayISO(), DEFAULT_HORIZON_DAYS), summary);

    return c.json({ schedule, generation: summary }, 201);
  } catch (error) {
    return internalError(c, 'daycareStanding.create', error);
  }
});

// Update a schedule. Already-generated occurrences are left alone — pattern
// changes apply to future, not-yet-generated dates only (staff skip/cancel
// individual days if the old pattern's bookings must go too).
app.put('/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!hasPermission(user.role, 'create_booking')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }

    const schedule = await loadSchedule(c.req.param('id'));
    if (!schedule) return c.json({ error: 'Standing schedule not found' }, 404);
    if (!canAccessLocation(user, schedule.location_id)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const body = await c.req.json();
    if (body.days !== undefined) {
      const days = parseDaysMap(body.days);
      if (!days) {
        return c.json({ error: 'Pick at least one weekday with a valid session' }, 400);
      }
      schedule.days = days;
    }
    if (body.billing_type !== undefined) {
      if (body.billing_type !== 'membership' && body.billing_type !== 'payg') {
        return c.json({ error: 'billing_type must be membership or payg' }, 400);
      }
      schedule.billing_type = body.billing_type;
    }
    if (body.start_date !== undefined) {
      if (!isISODate(body.start_date)) {
        return c.json({ error: 'A valid start date is required' }, 400);
      }
      schedule.start_date = body.start_date;
    }
    if (body.end_date !== undefined) {
      if (body.end_date === null || body.end_date === '') {
        schedule.end_date = undefined;
      } else if (!isISODate(body.end_date) || body.end_date < schedule.start_date) {
        return c.json({ error: 'End date must be a valid date on or after the start date' }, 400);
      } else {
        schedule.end_date = body.end_date;
      }
    }
    if (body.active !== undefined) {
      schedule.active = body.active === true;
    }
    if (body.notes !== undefined) {
      schedule.notes = typeof body.notes === 'string' && body.notes ? body.notes : undefined;
    }
    schedule.updated_at = new Date().toISOString();
    await kv.set(scheduleKey(schedule.id), schedule);

    const summary: GenerationSummary = { created: 0, already_handled: 0, warnings: [] };
    if (schedule.active) {
      const from = schedule.start_date > todayISO() ? schedule.start_date : todayISO();
      await generateForSchedule(user, schedule, from, addDaysISO(todayISO(), DEFAULT_HORIZON_DAYS), summary);
    }

    return c.json({ schedule, generation: summary });
  } catch (error) {
    return internalError(c, 'daycareStanding.update', error);
  }
});

// Record a per-occurrence exception: skip the day, or override its session.
// The change applies immediately (cancel/recreate the concrete booking) and
// never touches the series.
app.post('/:id/exceptions', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!hasPermission(user.role, 'create_booking')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }

    const schedule = await loadSchedule(c.req.param('id'));
    if (!schedule) return c.json({ error: 'Standing schedule not found' }, 404);
    if (!canAccessLocation(user, schedule.location_id)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const body = await c.req.json();
    if (!isISODate(body.date)) {
      return c.json({ error: 'A valid date is required' }, 400);
    }
    if (body.type !== 'skip' && body.type !== 'override') {
      return c.json({ error: 'type must be skip or override' }, 400);
    }
    if (body.type === 'override' && !isDaycareSession(body.session)) {
      return c.json({ error: 'An override needs a valid session' }, 400);
    }
    if (body.date < todayISO()) {
      return c.json({ error: 'Exceptions apply to today or future dates only' }, 400);
    }

    const exception: StandingException = {
      standing_booking_id: schedule.id,
      date: body.date,
      type: body.type,
      session: body.type === 'override' ? body.session : undefined,
      created_by_id: user.id,
      created_by_name: user.name || user.email || '',
      created_at: new Date().toISOString(),
    };
    await kv.set(exceptionKey(schedule.id, body.date), exception);

    const summary: GenerationSummary = { created: 0, already_handled: 0, warnings: [] };
    await reconcileOccurrence(
      user,
      schedule,
      body.date,
      body.type === 'skip' ? STANDING_SKIP_REASON : STANDING_OVERRIDE_REASON,
      summary,
    );

    return c.json({ exception, generation: summary }, 201);
  } catch (error) {
    return internalError(c, 'daycareStanding.addException', error);
  }
});

// Remove an exception — the pattern's own session comes back for that date.
app.delete('/:id/exceptions/:date', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!hasPermission(user.role, 'create_booking')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }

    const schedule = await loadSchedule(c.req.param('id'));
    if (!schedule) return c.json({ error: 'Standing schedule not found' }, 404);
    if (!canAccessLocation(user, schedule.location_id)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const date = c.req.param('date');
    if (!isISODate(date)) return c.json({ error: 'A valid date is required' }, 400);

    const existing = (await kv.get(exceptionKey(schedule.id, date))) as StandingException | null;
    if (!existing) return c.json({ error: 'No exception recorded for this date' }, 404);

    await kv.del(exceptionKey(schedule.id, date));

    // Restoring a skipped/overridden day must regenerate it — clear the
    // marker so reconcile can create the pattern booking again.
    const marker = (await kv.get(occurrenceKey(schedule.id, date))) as
      | StandingOccurrenceMarker
      | null;
    if (marker && marker.reason === 'generated') {
      await kv.del(occurrenceKey(schedule.id, date));
    }

    const summary: GenerationSummary = { created: 0, already_handled: 0, warnings: [] };
    await reconcileOccurrence(user, schedule, date, 'Standing schedule: exception removed', summary);

    return c.json({ removed: existing, generation: summary });
  } catch (error) {
    return internalError(c, 'daycareStanding.removeException', error);
  }
});

// On-demand generation for every active schedule the caller can see — the
// staff app fires this when the planner loads so upcoming weeks stay
// populated; idempotent, so over-calling is harmless.
app.post('/generate', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!hasPermission(user.role, 'create_booking')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const horizonDays = Math.min(
      MAX_HORIZON_DAYS,
      Math.max(1, Number(body?.horizon_days) || DEFAULT_HORIZON_DAYS),
    );

    const schedules = ((await kv.getByPrefix('daycare:standing:schedule:')) as StandingBooking[])
      .filter((s) => s && s.id && s.active)
      .filter((s) => canAccessLocation(user, s.location_id));

    const summary: GenerationSummary = { created: 0, already_handled: 0, warnings: [] };
    const from = todayISO();
    const to = addDaysISO(from, horizonDays);
    for (const schedule of schedules) {
      await generateForSchedule(user, schedule, from, to, summary);
    }

    return c.json({ schedules: schedules.length, from, to, ...summary });
  } catch (error) {
    return internalError(c, 'daycareStanding.generate', error);
  }
});

export default app;
