import { describe, it, expect } from 'vitest';
import {
  expandDateRange,
  nightsBetween,
  WEEKDAYS_ALL,
  WEEKDAYS_MON_FRI,
  type Weekday,
} from '../../src/app/modules/daycare/lib/multiDayBooking';

describe('expandDateRange', () => {
  it('includes both endpoints when every weekday is allowed', () => {
    // 2026-07-13 (Mon) .. 2026-07-15 (Wed)
    expect(expandDateRange('2026-07-13', '2026-07-15', WEEKDAYS_ALL)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
    ]);
  });

  it('returns a single date when start === end and that weekday is allowed', () => {
    expect(expandDateRange('2026-07-13', '2026-07-13', WEEKDAYS_ALL)).toEqual(['2026-07-13']);
  });

  it('skips weekends with Mon–Fri', () => {
    // 2026-07-13 Mon .. 2026-07-20 Mon spans a full week + Mon.
    expect(expandDateRange('2026-07-13', '2026-07-20', WEEKDAYS_MON_FRI)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-20',
    ]);
  });

  it('honours an arbitrary weekday subset (Mon + Thu)', () => {
    const set = new Set<Weekday>([1, 4]);
    expect(expandDateRange('2026-07-13', '2026-07-26', set)).toEqual([
      '2026-07-13',
      '2026-07-16',
      '2026-07-20',
      '2026-07-23',
    ]);
  });

  it('returns [] when end is before start', () => {
    expect(expandDateRange('2026-07-15', '2026-07-13', WEEKDAYS_ALL)).toEqual([]);
  });

  it('returns [] for malformed dates', () => {
    expect(expandDateRange('2026-7-1', '2026-07-15', WEEKDAYS_ALL)).toEqual([]);
    expect(expandDateRange('2026-02-31', '2026-03-02', WEEKDAYS_ALL)).toEqual([]);
    expect(expandDateRange('', '', WEEKDAYS_ALL)).toEqual([]);
  });

  it('returns [] when the range matches no selected weekday', () => {
    // 2026-07-18 Sat, 2026-07-19 Sun — no Mon–Fri days in range.
    expect(expandDateRange('2026-07-18', '2026-07-19', WEEKDAYS_MON_FRI)).toEqual([]);
  });

  it('caps the fan-out at maxDays', () => {
    const out = expandDateRange('2026-01-01', '2030-01-01', WEEKDAYS_ALL, 10);
    expect(out.length).toBe(10);
    expect(out[0]).toBe('2026-01-01');
  });
});

describe('nightsBetween', () => {
  it('counts inclusive nights', () => {
    expect(nightsBetween('2026-07-13', '2026-07-15')).toBe(2);
    expect(nightsBetween('2026-07-13', '2026-07-14')).toBe(1);
  });

  it('is 0 for same-day or reversed or malformed input', () => {
    expect(nightsBetween('2026-07-13', '2026-07-13')).toBe(0);
    expect(nightsBetween('2026-07-15', '2026-07-13')).toBe(0);
    expect(nightsBetween('bad', '2026-07-15')).toBe(0);
  });
});
