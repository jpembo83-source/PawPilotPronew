// dashboardWindow: the pure mapping from the dashboard's date-range filter to
// the fetch window (bookings start/end) and the single stats day.
import { describe, it, expect } from 'vitest';
import { dashboardWindow } from '../../src/app/modules/dashboard/dateRangeWindow';

// Fixed clock: 2026-07-21T12:00:00Z.
const NOW = new Date('2026-07-21T12:00:00Z');

describe('dashboardWindow', () => {
  it('today: a single-day window on today', () => {
    expect(dashboardWindow('today', NOW)).toEqual({
      startDate: '2026-07-21',
      endDate: '2026-07-21',
      statsDate: '2026-07-21',
      isSingleDay: true,
      includesToday: true,
      isForward: false,
    });
  });

  it('tomorrow: a single forward day with stats anchored to it', () => {
    expect(dashboardWindow('tomorrow', NOW)).toEqual({
      startDate: '2026-07-22',
      endDate: '2026-07-22',
      statsDate: '2026-07-22',
      isSingleDay: true,
      includesToday: false,
      isForward: true,
    });
  });

  it('yesterday: a single past day with stats anchored to it', () => {
    const win = dashboardWindow('yesterday', NOW);
    expect(win.startDate).toBe('2026-07-20');
    expect(win.endDate).toBe('2026-07-20');
    expect(win.statsDate).toBe('2026-07-20');
    expect(win.isForward).toBe(false);
  });

  it('7d: the last 7 days including today, stats on today', () => {
    const win = dashboardWindow('7d', NOW);
    expect(win.startDate).toBe('2026-07-15');
    expect(win.endDate).toBe('2026-07-21');
    expect(win.statsDate).toBe('2026-07-21');
    expect(win.isSingleDay).toBe(false);
    expect(win.includesToday).toBe(true);
  });

  it('next7d: the next 7 days including today, stats on today', () => {
    const win = dashboardWindow('next7d', NOW);
    expect(win.startDate).toBe('2026-07-21');
    expect(win.endDate).toBe('2026-07-27');
    expect(win.statsDate).toBe('2026-07-21');
    expect(win.includesToday).toBe(true);
    expect(win.isForward).toBe(false);
  });

  it('next30d and 30d span 30 days inclusive', () => {
    expect(dashboardWindow('next30d', NOW).endDate).toBe('2026-08-19');
    expect(dashboardWindow('30d', NOW).startDate).toBe('2026-06-22');
  });

  it('month boundaries roll over correctly', () => {
    const endOfMonth = new Date('2026-07-31T12:00:00Z');
    expect(dashboardWindow('tomorrow', endOfMonth).startDate).toBe('2026-08-01');
  });

  it('custom falls back to today', () => {
    expect(dashboardWindow('custom', NOW)).toEqual(dashboardWindow('today', NOW));
  });
});
