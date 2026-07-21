// Turns the dashboard's date-range choice into the concrete dates the data
// fetches need. Pure so it unit-tests without the store
// (tests/unit/dashboard-date-window.test.ts).
//
// Dates use the same UTC-ISO convention as the rest of the dashboard
// (new Date().toISOString().split('T')[0]) so a range of "today" matches
// exactly what the old hardcoded fetch requested.
import type { DateRange } from './store';

export interface DashboardWindow {
  /** Inclusive YYYY-MM-DD bounds of the selected window. */
  startDate: string;
  endDate: string;
  /**
   * The single day the /stats endpoint (capacity, alerts) describes: today
   * when the window includes it, otherwise the window's start. Multi-day
   * windows have no single capacity figure, so stats stay anchored to the
   * most operationally relevant day in the window.
   */
  statsDate: string;
  isSingleDay: boolean;
  includesToday: boolean;
  /** Window lies strictly after today (planning ahead). */
  isForward: boolean;
}

export function dashboardWindow(range: DateRange, now: Date = new Date()): DashboardWindow {
  const day = (offset: number): string => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().split('T')[0];
  };
  const today = day(0);

  let startDate = today;
  let endDate = today;
  switch (range) {
    case 'yesterday':
      startDate = endDate = day(-1);
      break;
    case 'tomorrow':
      startDate = endDate = day(1);
      break;
    case '7d':
      startDate = day(-6);
      break;
    case '30d':
      startDate = day(-29);
      break;
    case 'next7d':
      endDate = day(6);
      break;
    case 'next30d':
      endDate = day(29);
      break;
    case 'today':
    case 'custom':
    default:
      break;
  }

  const includesToday = startDate <= today && today <= endDate;
  return {
    startDate,
    endDate,
    statsDate: includesToday ? today : startDate,
    isSingleDay: startDate === endDate,
    includesToday,
    isForward: startDate > today,
  };
}
