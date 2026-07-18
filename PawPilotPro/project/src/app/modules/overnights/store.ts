import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import {
  OvernightReservation,
  NightlyCareLog,
  SleepingArea,
  ShiftHandover,
  OvernightsCapacity,
  CapacitySnapshot,
  TonightsBoarders,
  CheckInRequest,
  CheckInValidation,
  CheckOutRequest,
  OvernightEvent,
  OvernightCarerInfo,
  TransitionRequest,
  OvernightBillingBreakdown,
  ApiErrorResponse,
  OvernightReservationPayload,
  NightlyCareLogPayload,
  OvernightStats,
} from './types';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

export interface OvernightsState {
  reservations: OvernightReservation[];
  careLogs: NightlyCareLog[];
  sleepingAreas: SleepingArea[];
  handovers: ShiftHandover[];
  capacities: OvernightsCapacity[];
  events: OvernightEvent[];
  carers: OvernightCarerInfo[];

  tonightsBoarders: TonightsBoarders | null;

  isLoading: boolean;
  error: string | null;

  fetchReservations: (locationId?: string, startDate?: string, endDate?: string) => Promise<void>;
  createReservation: (reservation: Omit<OvernightReservation, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<OvernightReservation>;
  updateReservation: (id: string, updates: Partial<OvernightReservation>) => Promise<void>;
  cancelReservation: (id: string, reason: string) => Promise<void>;

  validateCheckIn: (reservationId: string) => Promise<CheckInValidation>;
  checkIn: (request: CheckInRequest) => Promise<void>;
  checkOut: (request: CheckOutRequest) => Promise<void>;

  transitionFromDaycare: (request: TransitionRequest) => Promise<OvernightReservation>;
  transitionToDaycare: (reservationId: string) => Promise<void>;

  fetchEvents: (stayId: string) => Promise<void>;

  fetchCarers: (locationId: string, date?: string) => Promise<void>;
  assignCarer: (stayId: string, carerId: string) => Promise<void>;

  calculateBilling: (params: string | { reservationId?: string; petId?: string; locationId?: string; startDate?: string; endDate?: string; totalNights?: number; currency?: string; pricePerNight?: number }) => Promise<OvernightBillingBreakdown>;

  fetchCareLogs: (reservationId?: string, date?: string) => Promise<void>;
  createCareLog: (careLog: Omit<NightlyCareLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<NightlyCareLog>;
  updateCareLog: (id: string, updates: Partial<NightlyCareLog>) => Promise<void>;

  fetchSleepingAreas: (locationId: string) => Promise<void>;
  createSleepingArea: (area: Omit<SleepingArea, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<SleepingArea>;
  updateSleepingArea: (id: string, updates: Partial<SleepingArea>) => Promise<void>;

  fetchHandovers: (locationId: string, date?: string) => Promise<void>;
  createHandover: (handover: Omit<ShiftHandover, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ShiftHandover>;
  acknowledgeHandover: (id: string) => Promise<void>;

  fetchCapacity: (locationId: string) => Promise<void>;
  updateCapacity: (locationId: string, capacity: Partial<OvernightsCapacity>) => Promise<void>;
  getCapacitySnapshot: (locationId: string, date: string) => Promise<CapacitySnapshot>;

  fetchTonightsBoarders: (locationId: string, date?: string) => Promise<void>;

  fetchStats: (locationId?: string, date?: string) => Promise<OvernightStats>;

  clearError: () => void;
}

export const useOvernightsStore = create<OvernightsState>((set, get) => ({
  reservations: [],
  careLogs: [],
  sleepingAreas: [],
  handovers: [],
  capacities: [],
  events: [],
  carers: [],
  tonightsBoarders: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchReservations: async (locationId?, startDate?, endDate?) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (locationId) params.append('locationId', locationId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`${API_URL}/overnights/reservations?${params}`, { headers });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch reservations');
      }
      const reservations = await res.json() as OvernightReservation[];
      set({ reservations, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createReservation: async (reservation) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/reservations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(reservation)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to create reservation');
      }
      const newReservation = await res.json() as OvernightReservationPayload;
      set(state => ({ reservations: [...state.reservations, newReservation], isLoading: false }));
      broadcastMutation('overnights', 'reservation', 'created', newReservation.id, undefined, newReservation.location_id);
      return newReservation;
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  updateReservation: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/reservations/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to update reservation');
      }
      const updated = await res.json() as OvernightReservationPayload;
      set(state => ({
        reservations: state.reservations.map(r => r.id === id ? updated : r),
        isLoading: false
      }));
      broadcastMutation('overnights', 'reservation', 'updated', id, undefined, updated.location_id);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  cancelReservation: async (id, reason) => {
    await get().updateReservation(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
    });
  },

  validateCheckIn: async (reservationId) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/overnights/check-in/validate?reservationId=${reservationId}`, { headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({})) as ApiErrorResponse;
      throw new Error(error.error || 'Failed to validate check-in');
    }
    return await res.json() as CheckInValidation;
  },

  checkIn: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/check-in`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Check-in failed');
      }
      const updated = await res.json() as OvernightReservationPayload;
      set(state => ({
        reservations: state.reservations.map(r => r.id === request.reservationId ? updated : r),
        isLoading: false
      }));
      broadcastMutation('overnights', 'reservation', 'updated', request.reservationId, { action: 'check-in' }, updated.location_id);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  checkOut: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/check-out`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Check-out failed');
      }
      const updated = await res.json() as OvernightReservationPayload;
      set(state => ({
        reservations: state.reservations.map(r => r.id === request.reservationId ? updated : r),
        isLoading: false
      }));
      broadcastMutation('overnights', 'reservation', 'updated', request.reservationId, { action: 'check-out' }, updated.location_id);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  transitionFromDaycare: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/transition/daycare-to-overnight`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Transition from daycare failed');
      }
      const newReservation = await res.json() as OvernightReservationPayload;
      set(state => ({
        reservations: [...state.reservations, newReservation],
        isLoading: false
      }));
      broadcastMutation('overnights', 'reservation', 'created', newReservation.id, { action: 'transition-from-daycare' });
      return newReservation;
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  transitionToDaycare: async (reservationId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/transition/overnight-to-daycare`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reservationId })
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Transition to daycare failed');
      }
      const updated = await res.json() as OvernightReservation;
      set(state => ({
        reservations: state.reservations.map(r => r.id === reservationId ? updated : r),
        isLoading: false
      }));
      broadcastMutation('overnights', 'reservation', 'updated', reservationId, { action: 'transition-to-daycare' });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  fetchEvents: async (stayId) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/events?stayId=${stayId}`, { headers });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch events');
      }
      const events = await res.json() as OvernightEvent[];
      set({ events, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  fetchCarers: async (locationId, date?) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ locationId });
      if (date) params.append('date', date);

      const res = await fetch(`${API_URL}/overnights/carers?${params}`, { headers });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch carers');
      }
      const carers = await res.json() as OvernightCarerInfo[];
      set({ carers, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  assignCarer: async (stayId, carerId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/assign-carer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ stayId, carerId })
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to assign carer');
      }
      const updated = await res.json() as OvernightReservation;
      set(state => ({
        reservations: state.reservations.map(r => r.id === stayId ? updated : r),
        isLoading: false
      }));
      broadcastMutation('overnights', 'reservation', 'updated', stayId, { action: 'carer-assigned' });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  calculateBilling: async (params) => {
    const headers = await getAuthHeaders();
    const body = typeof params === 'string' ? { reservationId: params } : params;
    const res = await fetch(`${API_URL}/overnights/calculate-billing`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const error = await res.json() as ApiErrorResponse;
      throw new Error(error.error || 'Failed to calculate billing');
    }
    return await res.json() as OvernightBillingBreakdown;
  },

  fetchCareLogs: async (reservationId?, date?) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (reservationId) params.append('reservationId', reservationId);
      if (date) params.append('date', date);

      const res = await fetch(`${API_URL}/overnights/care-logs?${params}`, { headers });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch care logs');
      }
      const careLogs = await res.json() as NightlyCareLog[];
      set({ careLogs, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createCareLog: async (careLog) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/care-logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(careLog)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to create care log');
      }
      const newLog = await res.json() as NightlyCareLogPayload;
      set(state => ({ careLogs: [...state.careLogs, newLog], isLoading: false }));
      broadcastMutation('overnights', 'care-log', 'created', newLog.id, undefined, newLog.location_id);
      return newLog;
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  updateCareLog: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/care-logs/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to update care log');
      }
      const updated = await res.json() as NightlyCareLogPayload;
      set(state => ({
        careLogs: state.careLogs.map(cl => cl.id === id ? updated : cl),
        isLoading: false
      }));
      broadcastMutation('overnights', 'care-log', 'updated', id, undefined, updated.location_id);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  fetchSleepingAreas: async (locationId) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/sleeping-areas?locationId=${locationId}`, { headers });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch sleeping areas');
      }
      const sleepingAreas = await res.json() as SleepingArea[];
      set({ sleepingAreas, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createSleepingArea: async (area) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/sleeping-areas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(area)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to create sleeping area');
      }
      const newArea = await res.json() as SleepingArea;
      set(state => ({ sleepingAreas: [...state.sleepingAreas, newArea], isLoading: false }));
      broadcastMutation('overnights', 'sleeping-area', 'created', newArea.id);
      return newArea;
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  updateSleepingArea: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/sleeping-areas/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to update sleeping area');
      }
      const updated = await res.json() as SleepingArea;
      set(state => ({
        sleepingAreas: state.sleepingAreas.map(sa => sa.id === id ? updated : sa),
        isLoading: false
      }));
      broadcastMutation('overnights', 'sleeping-area', 'updated', id);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  fetchHandovers: async (locationId, date?) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ locationId });
      if (date) params.append('date', date);

      const res = await fetch(`${API_URL}/overnights/handovers?${params}`, { headers });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch handovers');
      }
      const handovers = await res.json() as ShiftHandover[];
      set({ handovers, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createHandover: async (handover) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/handovers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(handover)
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to create handover');
      }
      const newHandover = await res.json() as ShiftHandover;
      set(state => ({ handovers: [...state.handovers, newHandover], isLoading: false }));
      broadcastMutation('overnights', 'handover', 'created', newHandover.id);
      return newHandover;
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  acknowledgeHandover: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/handovers/${id}/acknowledge`, {
        method: 'POST',
        headers
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to acknowledge handover');
      }
      const updated = await res.json() as ShiftHandover;
      set(state => ({
        handovers: state.handovers.map(h => h.id === id ? updated : h),
        isLoading: false
      }));
      broadcastMutation('overnights', 'handover', 'updated', id);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  fetchCapacity: async (locationId) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/capacity?locationId=${locationId}`, { headers });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch capacity');
      }
      const capacity = await res.json() as OvernightsCapacity | null;
      set({
        capacities: capacity ? [capacity] : [],
        isLoading: false
      });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  updateCapacity: async (locationId, capacity) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/overnights/capacity`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ locationId, ...capacity })
      });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to update capacity');
      }
      const updated = await res.json() as OvernightsCapacity;
      set({ capacities: [updated], isLoading: false });
      broadcastMutation('overnights', 'capacity', 'updated', locationId);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      throw e;
    }
  },

  getCapacitySnapshot: async (locationId, date) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/overnights/capacity/snapshot?locationId=${locationId}&date=${date}`, { headers });
    if (!res.ok) {
      const error = await res.json() as ApiErrorResponse;
      throw new Error(error.error || 'Failed to get capacity snapshot');
    }
    return await res.json() as CapacitySnapshot;
  },

  fetchTonightsBoarders: async (locationId, date?) => {
    try {
      set({ isLoading: true, error: null });
      const headers = await getAuthHeaders();
      const targetDate = date || new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/overnights/tonights-boarders?locationId=${locationId}&date=${targetDate}`, { headers });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(error.error || "Failed to fetch tonight's boarders");
      }
      const tonightsBoarders = await res.json() as TonightsBoarders;
      set({ tonightsBoarders, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  fetchStats: async (locationId?, date?) => {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (locationId) params.append('locationId', locationId);
      if (date) params.append('date', date);

      const res = await fetch(`${API_URL}/overnights/stats?${params}`, { headers });
      if (!res.ok) {
        const error = await res.json() as ApiErrorResponse;
        throw new Error(error.error || 'Failed to fetch stats');
      }
      return await res.json() as OvernightStats;
    } catch (e) {
      throw e;
    }
  },
}));
