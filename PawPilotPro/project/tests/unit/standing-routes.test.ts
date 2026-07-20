// Route-level guarantees for standing (recurring) daycare bookings:
//   - saving a pattern generates concrete bookings for the horizon, through
//     the SAME creation core as manual bookings (capacity counted, priced),
//   - generation is idempotent (re-running creates nothing new),
//   - a skip cancels exactly one occurrence and is reversible,
//   - an override changes exactly one occurrence's session,
//   - capacity-full days warn and are NOT booked (no silent overbooking).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

const kvStore = new Map<string, unknown>();
vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => Promise.resolve(void kvStore.set(key, value))),
  del: vi.fn((key: string) => Promise.resolve(void kvStore.delete(key))),
  mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k) => kvStore.get(k) ?? null))),
  mset: vi.fn(() => Promise.resolve()),
  mdel: vi.fn((keys: string[]) =>
    Promise.resolve(void keys.forEach((k) => kvStore.delete(k)))),
  getByPrefix: vi.fn((prefix: string) =>
    Promise.resolve(
      [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
    ),
  ),
}));

// Stand-in auth: requireAuth injects `currentUser` (staff — the role the
// standing workflow is for).
const currentUser = {
  id: 'user-1',
  role: 'staff',
  name: 'Front Desk',
  email: 'desk@example.com',
  tenantId: 'demo-tenant-001',
  locationIds: ['loc-1'],
};
vi.mock('../../supabase/functions/server/_shared/auth.ts', () => ({
  requireAuth: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', currentUser);
    await next();
  },
}));

import app from '../../supabase/functions/server/daycare_standing_routes.tsx';
import {
  sessionForDate,
  type StandingBooking,
} from '../../supabase/functions/server/lib/standing_bookings.ts';

const TENANT = 'demo-tenant-001';

interface StoredBooking {
  id: string;
  pet_name: string;
  booking_date: string;
  booking_status: string;
  service_id: string;
  service_type?: string;
  standing_booking_id?: string;
  cancellation_reason?: string;
  total_price: number;
  capacity_slot: number;
}

const request = (path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const bookings = (): StoredBooking[] =>
  [...kvStore.entries()]
    .filter(([k]) => k.startsWith('daycare:booking:'))
    .map(([, v]) => v as StoredBooking)
    .filter((b) => b && typeof b === 'object' && b.id && b.pet_name);

const activeBookings = () => bookings().filter((b) => b.booking_status !== 'cancelled');

const todayISO = () => new Date().toISOString().split('T')[0];

/** Dates the pattern should cover in [today, today+28], computed independently. */
function expectedDates(schedule: Pick<StandingBooking, 'days' | 'start_date' | 'end_date'>): string[] {
  const out: string[] = [];
  const cursor = new Date(`${todayISO()}T00:00:00Z`);
  for (let i = 0; i <= 28; i++) {
    const date = cursor.toISOString().split('T')[0];
    if (sessionForDate(schedule, date)) out.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function seedCustomer() {
  kvStore.set(`customer:${TENANT}:pet:hh-1:pet-1`, {
    id: 'pet-1',
    household_id: 'hh-1',
    name: 'Rex',
    vaccination_status: 'valid',
  });
  kvStore.set(`customer:${TENANT}:household:hh-1`, { id: 'hh-1', name: 'Muster' });
  kvStore.set('location:loc-1', { id: 'loc-1', capacity: { maxDogs: 5 } });
  kvStore.set('pricing:service:service-daycare-full', { base_price: 80, tax_rate: 0.077 });
  kvStore.set('pricing:service:service-daycare-half-am', { base_price: 50, tax_rate: 0.077 });
}

const MWF = { 1: 'full_day', 3: 'full_day', 5: 'full_day' } as const;

const createScheduleBody = {
  household_id: 'hh-1',
  pet_id: 'pet-1',
  location_id: 'loc-1',
  location_name: 'Main',
  days: MWF,
  billing_type: 'payg',
  start_date: () => todayISO(),
};

async function createSchedule(): Promise<{ schedule: StandingBooking; generation: { created: number; warnings: unknown[] } }> {
  const res = await request('/', 'POST', {
    ...createScheduleBody,
    start_date: todayISO(),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { schedule: StandingBooking; generation: { created: number; warnings: unknown[] } };
}

beforeEach(() => {
  kvStore.clear();
  currentUser.role = 'staff';
  seedCustomer();
});

describe('standing schedule creation + generation', () => {
  it('books the Mon/Wed/Fri pattern for the whole horizon through the normal booking path', async () => {
    const { schedule, generation } = await createSchedule();
    const expected = expectedDates(schedule);

    expect(generation.created).toBe(expected.length);
    expect(generation.warnings).toEqual([]);

    const generated = activeBookings();
    expect(generated.map((b) => b.booking_date).sort()).toEqual(expected);
    // Normal bookings: priced from the service, marked as standing, capacity counted.
    for (const b of generated) {
      expect(b.standing_booking_id).toBe(schedule.id);
      expect(b.total_price).toBeCloseTo(80 * 1.077, 5);
      expect(b.capacity_slot).toBe(1);
    }
    const cap = kvStore.get(`daycare:capacity:loc-1:${expected[0]}`) as { current_bookings: number };
    expect(cap.current_bookings).toBe(1);
  });

  it('re-running generation creates nothing new (idempotent)', async () => {
    await createSchedule();
    const before = activeBookings().length;

    const res = await request('/generate', 'POST', {});
    expect(res.status).toBe(200);
    const summary = (await res.json()) as { created: number };
    expect(summary.created).toBe(0);
    expect(activeBookings().length).toBe(before);
  });

  it('refuses a second active schedule for the same pet and location', async () => {
    await createSchedule();
    const res = await request('/', 'POST', { ...createScheduleBody, start_date: todayISO() });
    expect(res.status).toBe(409);
  });

  it('a pattern change books only not-yet-generated dates', async () => {
    const { schedule } = await createSchedule();
    const before = activeBookings().map((b) => b.booking_date).sort();

    // Mon/Wed/Fri → also Tuesdays. Existing days must be untouched; only new
    // Tuesday dates appear.
    const res = await request(`/${schedule.id}`, 'PUT', {
      days: { ...MWF, 2: 'full_day' },
    });
    expect(res.status).toBe(200);
    const after = activeBookings().map((b) => b.booking_date).sort();
    const added = after.filter((d) => !before.includes(d));
    expect(before.every((d) => after.includes(d))).toBe(true);
    expect(added.length).toBeGreaterThan(0);
    for (const d of added) {
      expect(new Date(`${d}T00:00:00Z`).getUTCDay()).toBe(2);
    }
  });
});

describe('per-occurrence exceptions', () => {
  it('a skip cancels exactly one occurrence and a restore brings it back', async () => {
    const { schedule } = await createSchedule();
    const dates = activeBookings().map((b) => b.booking_date).sort();
    const target = dates[1];

    const res = await request(`/${schedule.id}/exceptions`, 'POST', { date: target, type: 'skip' });
    expect(res.status).toBe(201);

    // Only the target day is gone; the cancelled record documents the skip.
    expect(activeBookings().map((b) => b.booking_date).sort()).toEqual(
      dates.filter((d) => d !== target),
    );
    const cancelled = bookings().find((b) => b.booking_date === target);
    expect(cancelled?.booking_status).toBe('cancelled');
    expect(cancelled?.cancellation_reason).toBe('Standing schedule: skipped for this day');

    // Regeneration must NOT resurrect the skipped day.
    await request('/generate', 'POST', {});
    expect(activeBookings().some((b) => b.booking_date === target)).toBe(false);

    // Restore: the pattern session comes back for that date.
    const restore = await request(`/${schedule.id}/exceptions/${target}`, 'DELETE');
    expect(restore.status).toBe(200);
    const restored = activeBookings().filter((b) => b.booking_date === target);
    expect(restored).toHaveLength(1);
    expect(restored[0].service_id).toBe('service-daycare-full');
  });

  it('an override switches one day to another session without touching the rest', async () => {
    const { schedule } = await createSchedule();
    const dates = activeBookings().map((b) => b.booking_date).sort();
    const target = dates[0];

    const res = await request(`/${schedule.id}/exceptions`, 'POST', {
      date: target,
      type: 'override',
      session: 'half_day_am',
    });
    expect(res.status).toBe(201);

    const forTarget = activeBookings().filter((b) => b.booking_date === target);
    expect(forTarget).toHaveLength(1);
    expect(forTarget[0].service_id).toBe('service-daycare-half-am');
    // Every other day still runs the pattern session.
    for (const b of activeBookings().filter((x) => x.booking_date !== target)) {
      expect(b.service_id).toBe('service-daycare-full');
    }
  });

  it('rejects exceptions for past dates and unknown schedules', async () => {
    const { schedule } = await createSchedule();
    const past = await request(`/${schedule.id}/exceptions`, 'POST', {
      date: '2020-01-01',
      type: 'skip',
    });
    expect(past.status).toBe(400);
    const missing = await request('/nope/exceptions', 'POST', { date: todayISO(), type: 'skip' });
    expect(missing.status).toBe(404);
  });
});

describe('capacity', () => {
  it('warns instead of overbooking a full day, then fills it once space frees up', async () => {
    // Location holds one dog only, and a manual booking (another dog) takes it.
    kvStore.set('location:loc-1', { id: 'loc-1', capacity: { maxDogs: 1 } });
    kvStore.set(`customer:${TENANT}:pet:hh-1:pet-2`, {
      id: 'pet-2',
      household_id: 'hh-1',
      name: 'Meg',
      vaccination_status: 'valid',
    });

    const { schedule, generation } = await createSchedule();
    const expected = expectedDates(schedule);
    // Rex takes the single slot everywhere — now block one future date by
    // skip, cancel Rex there, and let Meg book it manually… simpler: fill a
    // date beyond the pattern is impossible with capacity 1, so instead
    // assert the base case: everything booked (Rex alone fits capacity 1).
    expect(generation.created).toBe(expected.length);

    // Manually occupy the NEXT pattern date with Meg after skipping Rex —
    // then restoring Rex must warn (capacity full), not overbook.
    const target = expected[0];
    await request(`/${schedule.id}/exceptions`, 'POST', { date: target, type: 'skip' });
    const meg = {
      id: 'manual-1',
      pet_id: 'pet-2',
      pet_name: 'Meg',
      household_id: 'hh-1',
      location_id: 'loc-1',
      booking_date: target,
      booking_status: 'confirmed',
      check_in_status: 'not_checked_in',
      planned_start_time: '07:00',
      planned_end_time: '18:00',
    };
    kvStore.set('daycare:booking:manual-1', meg);
    const cap = kvStore.get(`daycare:capacity:loc-1:${target}`) as {
      current_bookings: number;
      available_slots: number;
      is_full: boolean;
      max_capacity: number;
    };
    cap.current_bookings += 1;
    cap.available_slots = cap.max_capacity - cap.current_bookings;
    cap.is_full = cap.available_slots <= 0;
    kvStore.set(`daycare:capacity:loc-1:${target}`, cap);

    const restore = await request(`/${schedule.id}/exceptions/${target}`, 'DELETE');
    expect(restore.status).toBe(200);
    const summary = (await restore.json()) as {
      generation: { created: number; warnings: { date: string; reason: string }[] };
    };
    expect(summary.generation.created).toBe(0);
    expect(summary.generation.warnings).toHaveLength(1);
    expect(summary.generation.warnings[0]).toMatchObject({ date: target, reason: 'capacity_full' });
    // Rex is NOT booked that day.
    expect(activeBookings().filter((b) => b.booking_date === target)).toHaveLength(1); // Meg only

    // Meg leaves; the next generation run fills the freed slot.
    meg.booking_status = 'cancelled';
    kvStore.set('daycare:booking:manual-1', meg);
    cap.current_bookings -= 1;
    cap.available_slots = cap.max_capacity - cap.current_bookings;
    cap.is_full = false;
    kvStore.set(`daycare:capacity:loc-1:${target}`, cap);

    const regen = await request('/generate', 'POST', {});
    expect(regen.status).toBe(200);
    const rex = activeBookings().filter((b) => b.booking_date === target);
    expect(rex).toHaveLength(1);
    expect(rex[0].pet_name).toBe('Rex');
  });

  it('never double-books a date that already has a manual booking', async () => {
    // Rex already has a manual booking today (a pattern day or not — the
    // duplicate guard is by pet+location+date+overlap).
    const today = todayISO();
    kvStore.set('daycare:booking:manual-rex', {
      id: 'manual-rex',
      pet_id: 'pet-1',
      pet_name: 'Rex',
      household_id: 'hh-1',
      location_id: 'loc-1',
      booking_date: today,
      booking_status: 'confirmed',
      check_in_status: 'not_checked_in',
      planned_start_time: '07:00',
      planned_end_time: '18:00',
    });

    const { schedule } = await createSchedule();
    const todaysForRex = activeBookings().filter(
      (b) => b.booking_date === today,
    );
    // Whether or not today is a pattern day, Rex appears at most once.
    expect(todaysForRex.length).toBeLessThanOrEqual(1);

    // If today IS a pattern day, the occurrence marker says already_booked
    // and repeated generation still creates nothing for it.
    await request('/generate', 'POST', {});
    expect(
      activeBookings().filter((b) => b.booking_date === today).length,
    ).toBeLessThanOrEqual(1);
    expect(schedule.id).toBeTruthy();
  });
});
