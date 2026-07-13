import { create } from 'zustand';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { projectId } from '../../../../utils/supabase/info';
import { useSettingsStore } from '../settings/store';
import type {
  CapacityBookingRecord,
  DailyCapacitySummary,
  PlannerBooking,
  ServiceCapacity,
  WeeklyCapacityView,
} from './types';
import type { PlannerOvernightStay } from './components/plannerFormat';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function capacityStatus(booked: number, total: number): ServiceCapacity['status'] {
  if (total === 0) return 'available';
  if (booked > total) return 'overbooked';
  if (booked >= total) return 'full';
  if (booked / total >= 0.8) return 'limited';
  return 'available';
}

export function getMaxDogs(locationId?: string): number {
  const { locations } = useSettingsStore.getState();
  if (locationId && locationId !== 'ALL') {
    const loc = locations.find(l => l?.id === locationId);
    const m = loc?.capacity?.maxDogs;
    if (m && m > 0) return m;
  }
  const total = locations.reduce((sum, l) => sum + (l?.capacity?.maxDogs || 0), 0);
  return total > 0 ? total : 20;
}

function buildDayCapacity(date: string, bookings: CapacityBookingRecord[], maxDogs: number): DailyCapacitySummary {
  const active = bookings.filter(
    b => b.booking_date === date && !['cancelled', 'no_show'].includes(b.booking_status ?? '')
  );
  const booked = active.length;
  const available = Math.max(0, maxDogs - booked);
  const utilization_percent = maxDogs > 0 ? Math.round((booked / maxDogs) * 100) : 0;

  return {
    date,
    daycare: {
      service: 'daycare',
      date,
      total_capacity: maxDogs,
      booked,
      available,
      utilization_percent,
      status: capacityStatus(booked, maxDogs),
    },
    grooming: null,
    overnights: null,
    transport: null,
  };
}

interface CapacityState {
  weeklyView: WeeklyCapacityView | null;
  selectedDate: string;
  dailySummary: DailyCapacitySummary | null;
  /** Every daycare booking in the visible week — feeds the planner grid
   *  and the per-day list. Includes cancelled (rendered struck-through,
   *  like the paper register). */
  weekBookings: PlannerBooking[];
  /** Boarding stays overlapping the visible week, folded into the planner so
   *  the capacity view is one pane of glass (daycare + overnight). */
  weekOvernights: PlannerOvernightStay[];
  isLoading: boolean;
  isLoadingBookings: boolean;
  error: string | null;
  currentLocationId: string | undefined;
  setSelectedDate: (date: string) => void;
  fetchWeeklyCapacity: (startDate: string, locationId?: string) => Promise<void>;
  fetchDailyCapacity: (date: string, locationId?: string) => Promise<void>;
  fetchWeekBookings: (startDate: string, locationId?: string) => Promise<void>;
  clearError: () => void;
}

export const useCapacityStore = create<CapacityState>((set, get) => ({
  weeklyView: null,
  selectedDate: formatDate(new Date()),
  dailySummary: null,
  weekBookings: [],
  weekOvernights: [],
  isLoading: false,
  isLoadingBookings: false,
  error: null,
  currentLocationId: undefined,

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().fetchDailyCapacity(date, get().currentLocationId);
  },

  fetchWeeklyCapacity: async (startDate, locationId) => {
    set({ isLoading: true, error: null, currentLocationId: locationId });
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ start_date: startDate });
      if (locationId && locationId !== 'ALL') params.append('location_id', locationId);

      const response = await fetch(`${API_BASE}/capacity/weekly?${params}`, { headers });
      if (response.ok) {
        const data = (await response.json()) as WeeklyCapacityView;
        set({ weeklyView: data, isLoading: false });
        return;
      }

      // Capacity API not yet implemented — derive from bookings
      const weekStart = getWeekStart(new Date(startDate));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const bookingParams = new URLSearchParams({
        start_date: formatDate(weekStart),
        end_date: formatDate(weekEnd),
      });
      if (locationId && locationId !== 'ALL') bookingParams.append('location_id', locationId);

      let bookings: CapacityBookingRecord[] = [];
      try {
        const bookingsRes = await fetch(`${API_BASE}/daycare/bookings?${bookingParams}`, { headers });
        if (bookingsRes.ok) bookings = (await bookingsRes.json()) as CapacityBookingRecord[];
      } catch { /* use empty bookings */ }

      const maxDogs = getMaxDogs(locationId);
      const days: DailyCapacitySummary[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        days.push(buildDayCapacity(formatDate(d), bookings, maxDogs));
      }

      set({
        weeklyView: { week_start: formatDate(weekStart), week_end: formatDate(weekEnd), days },
        isLoading: false,
      });
    } catch (error) {
      // Ensure we always show something rather than "No data"
      const weekStart = getWeekStart(new Date(startDate));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const maxDogs = getMaxDogs(locationId);
      const days: DailyCapacitySummary[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        days.push(buildDayCapacity(formatDate(d), [], maxDogs));
      }
      set({
        weeklyView: { week_start: formatDate(weekStart), week_end: formatDate(weekEnd), days },
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  fetchDailyCapacity: async (date, locationId) => {
    const resolvedLocationId = locationId ?? get().currentLocationId;
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ date });
      if (resolvedLocationId && resolvedLocationId !== 'ALL') params.append('location_id', resolvedLocationId);

      const response = await fetch(`${API_BASE}/capacity/daily?${params}`, { headers });
      if (response.ok) {
        const data = (await response.json()) as DailyCapacitySummary;
        set({ dailySummary: data, isLoading: false });
        return;
      }

      // Capacity API not yet implemented — derive from bookings
      const bookingParams = new URLSearchParams({ date });
      if (resolvedLocationId && resolvedLocationId !== 'ALL') bookingParams.append('location_id', resolvedLocationId);

      let bookings: CapacityBookingRecord[] = [];
      try {
        const bookingsRes = await fetch(`${API_BASE}/daycare/bookings?${bookingParams}`, { headers });
        if (bookingsRes.ok) bookings = (await bookingsRes.json()) as CapacityBookingRecord[];
      } catch { /* use empty bookings */ }

      const maxDogs = getMaxDogs(resolvedLocationId);
      set({ dailySummary: buildDayCapacity(date, bookings, maxDogs), isLoading: false });
    } catch (error) {
      const maxDogs = getMaxDogs(resolvedLocationId);
      set({ dailySummary: buildDayCapacity(date, [], maxDogs), error: (error as Error).message, isLoading: false });
    }
  },

  fetchWeekBookings: async (startDate, locationId) => {
    set({ isLoadingBookings: true });
    try {
      const headers = await getAuthHeaders();
      const weekStart = getWeekStart(new Date(startDate));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const params = new URLSearchParams({
        start_date: formatDate(weekStart),
        end_date: formatDate(weekEnd),
      });
      if (locationId && locationId !== 'ALL') params.append('location_id', locationId);

      const res = await fetch(`${API_BASE}/daycare/bookings?${params}`, { headers });
      if (res.ok) {
        const bookings = (await res.json()) as PlannerBooking[];
        set({ weekBookings: Array.isArray(bookings) ? bookings : [] });
      } else {
        set({ weekBookings: [] });
      }

      // Overnight boarders overlapping the week — folded into the planner so
      // the capacity view shows daycare + boarding as one pane. Best-effort:
      // a failure here never blocks the daycare planner.
      try {
        const onParams = new URLSearchParams({
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
        });
        if (locationId && locationId !== 'ALL') onParams.append('locationId', locationId);
        const onRes = await fetch(`${API_BASE}/overnights/reservations?${onParams}`, { headers });
        if (onRes.ok) {
          const raw = (await onRes.json()) as Array<Record<string, unknown>>;
          // Only accept primitive string/number fields — the API is trusted
          // but this keeps the mapping type-safe and drops anything odd.
          const str = (v: unknown): string | undefined =>
            typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
          const stays: PlannerOvernightStay[] = (Array.isArray(raw) ? raw : [])
            .map((r) => ({
              id: str(r.id) ?? '',
              petId: str(r.petId),
              petName: str(r.petName) ?? str(r.pet_name) ?? 'Boarder',
              startDate: str(r.startDate) ?? str(r.start_date) ?? '',
              endDate: str(r.endDate) ?? str(r.end_date) ?? '',
              status: str(r.status),
            }))
            .filter((s) => s.startDate && s.endDate);
          set({ weekOvernights: stays });
        } else {
          set({ weekOvernights: [] });
        }
      } catch {
        set({ weekOvernights: [] });
      }

      set({ isLoadingBookings: false });
    } catch {
      set({ weekBookings: [], weekOvernights: [], isLoadingBookings: false });
    }
  },

  clearError: () => set({ error: null }),
}));
