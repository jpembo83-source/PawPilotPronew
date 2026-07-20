import { describe, it, expect } from 'vitest';
import {
  planOccurrences,
  sessionForDate,
  parseDaysMap,
  isISODate,
  SESSION_DETAILS,
  type StandingBooking,
  type StandingException,
} from '../../supabase/functions/server/lib/standing_bookings.ts';
import {
  SESSION_DETAILS as CLIENT_SESSION_DETAILS,
} from '../../src/app/modules/daycare/lib/multiDayBooking';

// 2026-07-20 is a Monday.
const schedule = (overrides: Partial<StandingBooking> = {}): StandingBooking => ({
  id: 'standing-1',
  tenant_id: 'demo-tenant-001',
  household_id: 'hh-1',
  household_name: 'Muster',
  pet_id: 'pet-rex',
  pet_name: 'Rex',
  location_id: 'loc-1',
  location_name: 'Main',
  days: { 1: 'full_day', 3: 'full_day', 5: 'full_day' }, // Mon/Wed/Fri
  billing_type: 'payg',
  start_date: '2026-07-20',
  active: true,
  created_by_id: 'u1',
  created_by_name: 'Staff',
  created_at: '2026-07-20T08:00:00.000Z',
  updated_at: '2026-07-20T08:00:00.000Z',
  ...overrides,
});

const exception = (
  date: string,
  type: 'skip' | 'override',
  session?: StandingException['session'],
): [string, Pick<StandingException, 'type' | 'session'>] => [date, { type, session }];

describe('planOccurrences', () => {
  it('generates Mon/Wed/Fri full days across a 2-week window', () => {
    const out = planOccurrences(schedule(), { from: '2026-07-20', to: '2026-08-02' });
    expect(out.map((o) => o.date)).toEqual([
      '2026-07-20', '2026-07-22', '2026-07-24',
      '2026-07-27', '2026-07-29', '2026-07-31',
    ]);
    expect(out.every((o) => o.session === 'full_day')).toBe(true);
  });

  it('respects per-day sessions', () => {
    const out = planOccurrences(
      schedule({ days: { 1: 'half_day_am', 5: 'half_day_pm' } }),
      { from: '2026-07-20', to: '2026-07-26' },
    );
    expect(out).toEqual([
      { date: '2026-07-20', session: 'half_day_am' },
      { date: '2026-07-24', session: 'half_day_pm' },
    ]);
  });

  it('skipping one Wednesday removes only that occurrence', () => {
    const out = planOccurrences(schedule(), {
      from: '2026-07-20',
      to: '2026-08-02',
      exceptions: new Map([exception('2026-07-22', 'skip')]),
    });
    expect(out.map((o) => o.date)).toEqual([
      '2026-07-20', '2026-07-24',
      '2026-07-27', '2026-07-29', '2026-07-31',
    ]);
  });

  it('an override changes the session for that date only', () => {
    const out = planOccurrences(schedule(), {
      from: '2026-07-20',
      to: '2026-07-26',
      exceptions: new Map([exception('2026-07-22', 'override', 'half_day_am')]),
    });
    expect(out).toEqual([
      { date: '2026-07-20', session: 'full_day' },
      { date: '2026-07-22', session: 'half_day_am' },
      { date: '2026-07-24', session: 'full_day' },
    ]);
  });

  it('never returns already-handled dates (idempotent generation)', () => {
    const first = planOccurrences(schedule(), { from: '2026-07-20', to: '2026-08-02' });
    const handled = new Set(first.map((o) => o.date));
    const second = planOccurrences(schedule(), {
      from: '2026-07-20',
      to: '2026-08-02',
      alreadyHandled: handled,
    });
    expect(second).toEqual([]);
  });

  it('a schedule change affects only future, not-yet-generated dates', () => {
    // Week 1 generated under Mon/Wed/Fri, then the pattern changes to Tue.
    const week1 = planOccurrences(schedule(), { from: '2026-07-20', to: '2026-07-26' });
    const handled = new Set(week1.map((o) => o.date));
    const out = planOccurrences(schedule({ days: { 2: 'full_day' } }), {
      from: '2026-07-20',
      to: '2026-08-02',
      alreadyHandled: handled,
    });
    // Old week-1 days stay as generated (handled); only new-pattern days
    // that were never generated appear.
    expect(out.map((o) => o.date)).toEqual(['2026-07-21', '2026-07-28']);
  });

  it('respects start and end bounds', () => {
    const out = planOccurrences(
      schedule({ start_date: '2026-07-22', end_date: '2026-07-29' }),
      { from: '2026-07-20', to: '2026-08-09' },
    );
    expect(out.map((o) => o.date)).toEqual(['2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29']);
  });

  it('returns nothing for an inactive schedule or malformed window', () => {
    expect(planOccurrences(schedule({ active: false }), { from: '2026-07-20', to: '2026-08-02' })).toEqual([]);
    expect(planOccurrences(schedule(), { from: 'not-a-date', to: '2026-08-02' })).toEqual([]);
    expect(planOccurrences(schedule(), { from: '2026-08-02', to: '2026-07-20' })).toEqual([]);
  });
});

describe('sessionForDate', () => {
  it('resolves the pattern session and honours overrides and skips', () => {
    const s = schedule();
    expect(sessionForDate(s, '2026-07-20')).toBe('full_day');
    expect(sessionForDate(s, '2026-07-21')).toBeNull();
    expect(sessionForDate(s, '2026-07-20', { type: 'skip' })).toBeNull();
    expect(sessionForDate(s, '2026-07-20', { type: 'override', session: 'half_day_pm' })).toBe('half_day_pm');
  });

  it('is null outside the start/end bounds', () => {
    const s = schedule({ start_date: '2026-07-22', end_date: '2026-07-24' });
    expect(sessionForDate(s, '2026-07-20')).toBeNull(); // Monday before start
    expect(sessionForDate(s, '2026-07-27')).toBeNull(); // Monday after end
  });
});

describe('parseDaysMap / isISODate', () => {
  it('accepts a valid weekday→session map', () => {
    expect(parseDaysMap({ 1: 'full_day', 5: 'half_day_am' })).toEqual({ 1: 'full_day', 5: 'half_day_am' });
  });
  it('rejects bad weekdays, bad sessions, and empty maps', () => {
    expect(parseDaysMap({ 7: 'full_day' })).toBeNull();
    expect(parseDaysMap({ 1: 'overnight' })).toBeNull();
    expect(parseDaysMap({})).toBeNull();
    expect(parseDaysMap('mon')).toBeNull();
  });
  it('isISODate accepts real dates only', () => {
    expect(isISODate('2026-07-20')).toBe(true);
    expect(isISODate('2026-02-31')).toBe(false);
    expect(isISODate('yesterday')).toBe(false);
  });
});

describe('session catalogue', () => {
  it('server mirror matches the client source of truth (times + service ids)', () => {
    for (const key of Object.keys(SESSION_DETAILS) as (keyof typeof SESSION_DETAILS)[]) {
      expect(SESSION_DETAILS[key].serviceId).toBe(CLIENT_SESSION_DETAILS[key].serviceId);
      expect(SESSION_DETAILS[key].start).toBe(CLIENT_SESSION_DETAILS[key].start);
      expect(SESSION_DETAILS[key].end).toBe(CLIENT_SESSION_DETAILS[key].end);
    }
  });
});
