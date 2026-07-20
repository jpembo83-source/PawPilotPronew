// Standing (recurring) daycare schedules — client store.
// Talks to /daycare-standing (see supabase/functions/server/daycare_standing_routes.tsx).

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import type { DaycareSession, Weekday } from './lib/multiDayBooking';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare-standing`;

/** Cancellation reason the server stamps on a skipped occurrence — the
 *  planner uses it to offer "Restore" only on skips, not manual cancellations.
 *  Keep in sync with daycare_standing_routes.tsx. */
export const STANDING_SKIP_REASON = 'Standing schedule: skipped for this day';

export interface StandingBooking {
  id: string;
  household_id: string;
  household_name: string;
  pet_id: string;
  pet_name: string;
  location_id: string;
  location_name: string;
  days: Partial<Record<Weekday, DaycareSession>>;
  billing_type: 'membership' | 'payg';
  start_date: string;
  end_date?: string;
  active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StandingGenerationSummary {
  created: number;
  already_handled: number;
  warnings: { standing_booking_id: string; pet_name: string; date: string; reason: string }[];
}

export interface StandingScheduleInput {
  household_id: string;
  pet_id: string;
  location_id: string;
  location_name?: string;
  days: Partial<Record<Weekday, DaycareSession>>;
  billing_type: 'membership' | 'payg';
  start_date: string;
  end_date?: string | null;
  notes?: string;
  active?: boolean;
}

interface ApiErrorBody {
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error || 'Request failed');
  }
  return (await response.json()) as T;
}

// The planner triggers generation on load; over-calling is harmless (the
// server is idempotent) but pointless, so throttle to once per interval.
const GENERATE_THROTTLE_MS = 5 * 60 * 1000;
let lastGenerateAt = 0;

interface StandingState {
  schedules: StandingBooking[];
  isLoading: boolean;
  error: string | null;

  fetchSchedules: (filters?: { pet_id?: string; household_id?: string }) => Promise<StandingBooking[]>;
  createSchedule: (
    input: StandingScheduleInput,
  ) => Promise<{ schedule: StandingBooking; generation: StandingGenerationSummary }>;
  updateSchedule: (
    id: string,
    input: Partial<StandingScheduleInput>,
  ) => Promise<{ schedule: StandingBooking; generation: StandingGenerationSummary }>;
  addException: (
    scheduleId: string,
    date: string,
    type: 'skip' | 'override',
    session?: DaycareSession,
  ) => Promise<StandingGenerationSummary>;
  removeException: (scheduleId: string, date: string) => Promise<StandingGenerationSummary>;
  /** Idempotent horizon top-up; throttled unless `force`. Resolves to the
   *  generation summary, or null when throttled/failed (best-effort). */
  generate: (opts?: { force?: boolean }) => Promise<StandingGenerationSummary | null>;
  clearError: () => void;
}

export const useStandingStore = create<StandingState>((set) => ({
  schedules: [],
  isLoading: false,
  error: null,

  fetchSchedules: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.pet_id) params.append('pet_id', filters.pet_id);
      if (filters?.household_id) params.append('household_id', filters.household_id);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const schedules = await request<StandingBooking[]>(`/${qs}`);
      set({ schedules, isLoading: false });
      return schedules;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  createSchedule: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const result = await request<{ schedule: StandingBooking; generation: StandingGenerationSummary }>(
        '/',
        { method: 'POST', body: JSON.stringify(input) },
      );
      set((state) => ({ schedules: [...state.schedules, result.schedule], isLoading: false }));
      void broadcastMutation('daycare', 'booking', 'created', result.schedule.id, undefined, result.schedule.location_id);
      return result;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateSchedule: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const result = await request<{ schedule: StandingBooking; generation: StandingGenerationSummary }>(
        `/${id}`,
        { method: 'PUT', body: JSON.stringify(input) },
      );
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? result.schedule : s)),
        isLoading: false,
      }));
      void broadcastMutation('daycare', 'booking', 'updated', id, undefined, result.schedule.location_id);
      return result;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  addException: async (scheduleId, date, type, session) => {
    const result = await request<{ generation: StandingGenerationSummary }>(
      `/${scheduleId}/exceptions`,
      { method: 'POST', body: JSON.stringify({ date, type, session }) },
    );
    void broadcastMutation('daycare', 'booking', 'updated', scheduleId, { date, type });
    return result.generation;
  },

  removeException: async (scheduleId, date) => {
    const result = await request<{ generation: StandingGenerationSummary }>(
      `/${scheduleId}/exceptions/${date}`,
      { method: 'DELETE' },
    );
    void broadcastMutation('daycare', 'booking', 'updated', scheduleId, { date, type: 'restore' });
    return result.generation;
  },

  generate: async (opts) => {
    const now = Date.now();
    if (!opts?.force && now - lastGenerateAt < GENERATE_THROTTLE_MS) return null;
    lastGenerateAt = now;
    try {
      const summary = await request<StandingGenerationSummary>('/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (summary.created > 0) {
        void broadcastMutation('daycare', 'booking', 'created', 'standing-generate');
      }
      return summary;
    } catch {
      // Best-effort: the planner still renders whatever exists. Allow an
      // immediate retry on the next load rather than waiting out the throttle.
      lastGenerateAt = 0;
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
