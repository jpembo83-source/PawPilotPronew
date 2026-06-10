// Grooming Store - MDC Operations Centre
// Zustand store for grooming salon operations

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import type {
  GroomingAppointment,
  GroomingStats,
  GroomingFilters,
  GroomingCheckInValidation,
  Groomer,
  GroomingQueueItem,
} from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/grooming`;

// ============================================================================
// STORE STATE
// ============================================================================

interface GroomingState {
  // Data
  appointments: GroomingAppointment[];
  selectedAppointment: GroomingAppointment | null;
  queue: GroomingQueueItem[];
  groomers: Groomer[];
  stats: GroomingStats | null;
  
  // Filters
  filters: GroomingFilters;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions - Appointments
  fetchAppointments: (filters?: GroomingFilters) => Promise<void>;
  fetchAppointmentById: (id: string) => Promise<GroomingAppointment | null>;
  createAppointment: (data: Partial<GroomingAppointment>) => Promise<GroomingAppointment>;
  updateAppointment: (id: string, data: Partial<GroomingAppointment>) => Promise<GroomingAppointment>;
  cancelAppointment: (id: string, reason: string) => Promise<GroomingAppointment>;
  
  // Actions - Check-in/Progress/Checkout
  validateCheckIn: (appointmentId: string) => Promise<GroomingCheckInValidation>;
  checkIn: (appointmentId: string, data?: { notes?: string }) => Promise<GroomingAppointment>;
  startGrooming: (appointmentId: string, groomerId: string) => Promise<GroomingAppointment>;
  completeGrooming: (appointmentId: string, data: { groomer_notes?: string; photos?: string[] }) => Promise<GroomingAppointment>;
  checkOut: (appointmentId: string, notes?: string) => Promise<GroomingAppointment>;
  
  // Actions - Queue
  fetchQueue: (locationId?: string) => Promise<void>;
  
  // Actions - Groomers
  fetchGroomers: (locationId?: string) => Promise<void>;
  
  // Actions - Stats
  fetchStats: (locationId?: string, date?: string) => Promise<void>;
  
  // Actions - Search
  searchCustomers: (query: string) => Promise<any[]>;
  
  // Filters
  setFilters: (filters: GroomingFilters) => void;
  clearFilters: () => void;
  
  // UI
  setSelectedAppointment: (appointment: GroomingAppointment | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useGroomingStore = create<GroomingState>((set, get) => ({
  // Initial State
  appointments: [],
  selectedAppointment: null,
  queue: [],
  groomers: [],
  stats: null,
  filters: {},
  isLoading: false,
  error: null,
  
  // ============================================================================
  // APPOINTMENTS
  // ============================================================================
  
  fetchAppointments: async (filters?: GroomingFilters) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      const appliedFilters = filters || get().filters;
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
      
      const response = await fetch(`${BASE_URL}/appointments?${params}`, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch appointments');
      }
      
      const data = await response.json();
      set({ appointments: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchAppointmentById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${id}`, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch appointment');
      }
      
      const data = await response.json();
      set({ selectedAppointment: data, isLoading: false });
      return data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createAppointment: async (data: Partial<GroomingAppointment>) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create appointment');
      }
      
      const appointment = await response.json();
      set(state => ({
        appointments: [...state.appointments, appointment],
        isLoading: false,
      }));
      return appointment;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateAppointment: async (id: string, data: Partial<GroomingAppointment>) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update appointment');
      }
      
      const appointment = await response.json();
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? appointment : a),
        selectedAppointment: state.selectedAppointment?.id === id ? appointment : state.selectedAppointment,
        isLoading: false,
      }));
      return appointment;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  cancelAppointment: async (id: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${id}/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel appointment');
      }
      
      const appointment = await response.json();
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? appointment : a),
        isLoading: false,
      }));
      return appointment;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // CHECK-IN / PROGRESS / CHECKOUT
  // ============================================================================
  
  validateCheckIn: async (appointmentId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${appointmentId}/validate-checkin`, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to validate check-in');
      }
      
      return await response.json();
    } catch (error: any) {
      throw error;
    }
  },
  
  checkIn: async (appointmentId: string, data?: { notes?: string }) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${appointmentId}/check-in`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data || {}),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check in');
      }
      
      const appointment = await response.json();
      set(state => ({
        appointments: state.appointments.map(a => a.id === appointmentId ? appointment : a),
        isLoading: false,
      }));
      
      // Refresh queue
      get().fetchQueue();
      
      return appointment;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  startGrooming: async (appointmentId: string, groomerId: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${appointmentId}/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ groomer_id: groomerId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start grooming');
      }
      
      const appointment = await response.json();
      set(state => ({
        appointments: state.appointments.map(a => a.id === appointmentId ? appointment : a),
        isLoading: false,
      }));
      
      // Refresh queue and groomers
      get().fetchQueue();
      get().fetchGroomers();
      
      return appointment;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  completeGrooming: async (appointmentId: string, data: { groomer_notes?: string; photos?: string[] }) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${appointmentId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete grooming');
      }
      
      const appointment = await response.json();
      set(state => ({
        appointments: state.appointments.map(a => a.id === appointmentId ? appointment : a),
        isLoading: false,
      }));
      
      // Refresh groomers
      get().fetchGroomers();
      
      return appointment;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  checkOut: async (appointmentId: string, notes?: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/appointments/${appointmentId}/check-out`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ notes }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check out');
      }
      
      const appointment = await response.json();
      set(state => ({
        appointments: state.appointments.map(a => a.id === appointmentId ? appointment : a),
        isLoading: false,
      }));
      return appointment;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // QUEUE
  // ============================================================================
  
  fetchQueue: async (locationId?: string) => {
    try {
      const headers = await getAuthHeaders();
      const params = locationId ? `?location_id=${locationId}` : '';
      const response = await fetch(`${BASE_URL}/queue${params}`, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch queue');
      }
      
      const data = await response.json();
      set({ queue: data });
    } catch (error: any) {
      console.error('Failed to fetch queue:', error);
    }
  },
  
  // ============================================================================
  // GROOMERS
  // ============================================================================
  
  fetchGroomers: async (locationId?: string) => {
    try {
      const headers = await getAuthHeaders();
      const params = locationId ? `?location_id=${locationId}` : '';
      const response = await fetch(`${BASE_URL}/groomers${params}`, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch groomers');
      }
      
      const data = await response.json();
      set({ groomers: data });
    } catch (error: any) {
      console.error('Failed to fetch groomers:', error);
    }
  },
  
  // ============================================================================
  // STATS
  // ============================================================================
  
  fetchStats: async (locationId?: string, date?: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (locationId) params.append('location_id', locationId);
      if (date) params.append('date', date);
      
      const response = await fetch(`${BASE_URL}/stats?${params}`, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch stats');
      }
      
      const data = await response.json();
      set({ stats: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  // ============================================================================
  // SEARCH
  // ============================================================================
  
  searchCustomers: async (query: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/search?q=${encodeURIComponent(query)}`,
        { headers }
      );
      
      if (!response.ok) {
        return [];
      }
      
      return await response.json();
    } catch (error) {
      return [];
    }
  },
  
  // ============================================================================
  // FILTERS
  // ============================================================================
  
  setFilters: (filters: GroomingFilters) => {
    set({ filters });
  },
  
  clearFilters: () => {
    set({ filters: {} });
  },
  
  // ============================================================================
  // UI
  // ============================================================================
  
  setSelectedAppointment: (appointment: GroomingAppointment | null) => {
    set({ selectedAppointment: appointment });
  },
  
  clearError: () => {
    set({ error: null });
  },
  
  reset: () => {
    set({
      appointments: [],
      selectedAppointment: null,
      queue: [],
      groomers: [],
      stats: null,
      filters: {},
      isLoading: false,
      error: null,
    });
  },
}));
