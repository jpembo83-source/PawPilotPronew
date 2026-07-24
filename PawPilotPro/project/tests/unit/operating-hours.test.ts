// Operating hours enforcement: the Settings → Organisation "Default
// Operating Hours" free-text field parsed and applied to booking times —
// daycare (HH:MM planned times via createBookingCore), grooming
// (appointment_time), and portal requests (ISO instants in the org's
// timezone). Fail-open policy: no parseable hours configured → no
// enforcement; configured hours → out-of-window times rejected.
import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  parseOperatingHours,
  operatingHoursFromOrg,
  orgTimezone,
  checkTimeWithinHours,
  checkWindowWithinHours,
  clampWindowToHours,
  minutesInTimeZone,
  checkIsoWindowWithinHours,
} from '../../supabase/functions/server/lib/operating_hours.ts';
import {
  parseOperatingHours as parseClient,
  isTimeWithinHours,
} from '../../src/app/lib/operatingHours.ts';

const HOURS = parseOperatingHours('07:30 - 18:30')!;

describe('parseOperatingHours', () => {
  it('parses the settings screen format', () => {
    expect(HOURS).toMatchObject({ start: 450, end: 1110, label: '07:30–18:30' });
  });
  it('tolerates the formats humans type', () => {
    expect(parseOperatingHours('7:00-19:00')).toMatchObject({ start: 420, end: 1140 });
    expect(parseOperatingHours('07:30 – 18:30')?.start).toBe(450); // en dash
    expect(parseOperatingHours('07:30 to 18:30')?.end).toBe(1110);
  });
  it('returns null for garbage and degenerate windows — enforcement then skips', () => {
    expect(parseOperatingHours('')).toBeNull();
    expect(parseOperatingHours('open early, close late')).toBeNull();
    expect(parseOperatingHours('18:30 - 07:30')).toBeNull(); // end before start
    expect(parseOperatingHours('07:30')).toBeNull();
    expect(parseOperatingHours(undefined)).toBeNull();
    expect(parseTimeToMinutes('25:00')).toBeNull();
  });
  it('reads the org settings record shape', () => {
    expect(operatingHoursFromOrg({ defaultOperatingHours: '07:30 - 18:30' })?.start).toBe(450);
    expect(operatingHoursFromOrg({})).toBeNull();
    expect(operatingHoursFromOrg(undefined)).toBeNull();
    expect(orgTimezone({ timezone: 'Europe/Zurich' })).toBe('Europe/Zurich');
    expect(orgTimezone({})).toBe('Europe/London');
  });
});

describe('checkTimeWithinHours / checkWindowWithinHours (daycare + grooming)', () => {
  it('accepts times inside the window, inclusive of both edges', () => {
    expect(checkTimeWithinHours('07:30', HOURS).ok).toBe(true);
    expect(checkTimeWithinHours('12:00', HOURS).ok).toBe(true);
    expect(checkTimeWithinHours('18:30', HOURS).ok).toBe(true);
  });
  it('rejects times outside the window with a message naming the hours', () => {
    const early = checkTimeWithinHours('07:00', HOURS, 'appointment time');
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toContain('07:30–18:30');
    expect(checkTimeWithinHours('19:00', HOURS).ok).toBe(false);
    expect(checkTimeWithinHours('23:45', HOURS).ok).toBe(false);
  });
  it('absent times pass (planned times are optional on daycare bookings)', () => {
    expect(checkTimeWithinHours(undefined, HOURS).ok).toBe(true);
    expect(checkTimeWithinHours('', HOURS).ok).toBe(true);
    expect(checkWindowWithinHours({}, HOURS).ok).toBe(true);
  });
  it('provided-but-malformed times are rejected, not silently accepted', () => {
    expect(checkTimeWithinHours('24:00', HOURS).ok).toBe(false);
    expect(checkTimeWithinHours('noonish', HOURS).ok).toBe(false);
  });
  it('validates the start/end pair and names the failing bound', () => {
    const r = checkWindowWithinHours({ start: '08:00', end: '19:00' }, HOURS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('end time');
    expect(checkWindowWithinHours({ start: '08:00', end: '17:00' }, HOURS).ok).toBe(true);
  });
});

describe('clampWindowToHours (daycare sessions — fixed catalogue times)', () => {
  it('clamps the catalogue full day (07:00–18:00) into 07:30–18:30 hours', () => {
    expect(clampWindowToHours({ start: '07:00', end: '18:00' }, HOURS)).toEqual({
      start: '07:30',
      end: '18:00',
    });
  });
  it('clamps an end past closing down to the close', () => {
    expect(clampWindowToHours({ start: '08:00', end: '19:00' }, HOURS)).toEqual({
      start: '08:00',
      end: '18:30',
    });
  });
  it('leaves windows already inside the hours untouched', () => {
    expect(clampWindowToHours({ start: '09:00', end: '17:00' }, HOURS)).toEqual({
      start: '09:00',
      end: '17:00',
    });
  });
  it('refuses a session with no overlap at all (PM session, morning-only org)', () => {
    const morningOnly = parseOperatingHours('08:00 - 12:00')!;
    expect(clampWindowToHours({ start: '13:00', end: '18:00' }, morningOnly)).toBeNull();
    expect(clampWindowToHours({ start: '13:00' }, morningOnly)).toBeNull();
    expect(clampWindowToHours({ end: '07:00' }, morningOnly)).toBeNull();
  });
  it('passes absent times through unchanged', () => {
    expect(clampWindowToHours({}, HOURS)).toEqual({ start: undefined, end: undefined });
    expect(clampWindowToHours({ start: '07:00' }, HOURS)).toEqual({
      start: '07:30',
      end: undefined,
    });
  });
});

describe('ISO instants in the org timezone (portal requests)', () => {
  it('converts instants to local wall time — including BST', () => {
    // 08:00 UTC in July is 09:00 in London (BST)…
    expect(minutesInTimeZone('2026-07-24T08:00:00Z', 'Europe/London')).toBe(9 * 60);
    // …and 08:00 in London in January (GMT).
    expect(minutesInTimeZone('2026-01-24T08:00:00Z', 'Europe/London')).toBe(8 * 60);
    expect(minutesInTimeZone('not-a-date', 'Europe/London')).toBeNull();
    expect(minutesInTimeZone('2026-07-24T08:00:00Z', 'Not/AZone')).toBeNull();
  });
  it('rejects out-of-hours requests using local time, not UTC', () => {
    // 06:45 UTC in July = 07:45 London → inside a 07:30 window.
    expect(
      checkIsoWindowWithinHours(
        { startAt: '2026-07-24T06:45:00Z', endAt: '2026-07-24T16:00:00Z' },
        HOURS,
        'Europe/London',
      ).ok,
    ).toBe(true);
    // 06:45 UTC in January = 06:45 London → before opening.
    const winter = checkIsoWindowWithinHours(
      { startAt: '2026-01-24T06:45:00Z', endAt: '2026-01-24T16:00:00Z' },
      HOURS,
      'Europe/London',
    );
    expect(winter.ok).toBe(false);
    if (!winter.ok) expect(winter.error).toContain('start time');
    // Pickup after close.
    expect(
      checkIsoWindowWithinHours(
        { startAt: '2026-01-24T09:00:00Z', endAt: '2026-01-24T19:00:00Z' },
        HOURS,
        'Europe/London',
      ).ok,
    ).toBe(false);
  });
  it('fails open on uninterpretable instants or timezones', () => {
    expect(
      checkIsoWindowWithinHours({ startAt: 'garbage' }, HOURS, 'Europe/London').ok,
    ).toBe(true);
    expect(
      checkIsoWindowWithinHours({ startAt: '2026-01-24T05:00:00Z' }, HOURS, 'Not/AZone').ok,
    ).toBe(true);
  });
});

describe('client mirror (src/app/lib/operatingHours.ts)', () => {
  it('parses identically to the server and exposes min/max labels', () => {
    const c = parseClient('07:30 - 18:30')!;
    expect(c.start).toBe(HOURS.start);
    expect(c.end).toBe(HOURS.end);
    expect(c.startLabel).toBe('07:30');
    expect(c.endLabel).toBe('18:30');
  });
  it('isTimeWithinHours matches server acceptance', () => {
    const c = parseClient('07:30 - 18:30');
    expect(isTimeWithinHours('07:30', c)).toBe(true);
    expect(isTimeWithinHours('19:00', c)).toBe(false);
    expect(isTimeWithinHours('', c)).toBe(true);
    expect(isTimeWithinHours('09:00', null)).toBe(true); // no hours → no constraint
  });
});
