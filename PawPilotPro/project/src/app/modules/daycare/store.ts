// Daycare Store - MDC Operations Centre
// Zustand store for daycare operations management

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import type {
  DaycareBooking,
  AttendanceRecord,
  DaycareStats,
  DaycareFilters,
  CheckInValidation,
  DaycareCapacity,
  DaycareEvent,
} from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare`;

// ============================================================================
// STORE STATE
// ============================================================================

interface DaycareState {
  // Data
  bookings: DaycareBooking[];
  selectedBooking: DaycareBooking | null;
  attendance: AttendanceRecord[];
  stats: DaycareStats | null;
  capacity: DaycareCapacity | null;
  
  // Filters
  filters: DaycareFilters;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions - Bookings
  fetchBookings: (filters?: DaycareFilters) => Promise<void>;
  fetchBookingById: (id: string) => Promise<DaycareBooking | null>;
  createBooking: (data: Partial<DaycareBooking>) => Promise<DaycareBooking>;
  cancelBooking: (id: string, reason: string) => Promise<DaycareBooking>;
  searchCustomers: (query: string) => Promise<any[]>;
  
  // Actions - Check-in/out
  validateCheckIn: (bookingId: string) => Promise<CheckInValidation>;
  checkIn: (bookingId: string, data: { handover_notes?: string; warnings_acknowledged?: boolean }) => Promise<{ booking: DaycareBooking; attendance: AttendanceRecord }>;
  checkOut: (bookingId: string, checkout_notes?: string, checkout_time?: string) => Promise<DaycareBooking>;
  
  // Actions - Attendance
  fetchActiveAttendance: (locationId?: string) => Promise<void>;
  
  // Actions - Stats
  fetchStats: (locationId?: string, date?: string) => Promise<void>;
  
  // Events (Audit Trail)
  fetchEvents: (params?: { booking_id?: string; location_id?: string; limit?: number }) => Promise<DaycareEvent[]>;
  
  // Filters
  setFilters: (filters: DaycareFilters) => void;
  clearFilters: () => void;
  
  // UI
  setSelectedBooking: (booking: DaycareBooking | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useDaycareStore = create<DaycareState>((set, get) => ({
  // Initial State
  bookings: [],
  selectedBooking: null,
  attendance: [],
  stats: null,
  capacity: null,
  filters: {},
  isLoading: false,
  error: null,
  
  // ============================================================================
  // BOOKINGS
  // ============================================================================
  
  fetchBookings: async (filters?: DaycareFilters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      
      const currentFilters = filters || get().filters;
      
      if (currentFilters.location_id) params.append('location_id', currentFilters.location_id);
      if (currentFilters.date) params.append('date', currentFilters.date);
      if (currentFilters.start_date) params.append('start_date', currentFilters.start_date);
      if (currentFilters.end_date) params.append('end_date', currentFilters.end_date);
      if (currentFilters.booking_status) params.append('booking_status', currentFilters.booking_status);
      if (currentFilters.check_in_status) params.append('check_in_status', currentFilters.check_in_status);
      if (currentFilters.pet_id) params.append('pet_id', currentFilters.pet_id);
      if (currentFilters.household_id) params.append('household_id', currentFilters.household_id);
      if (currentFilters.search) params.append('search', currentFilters.search);
      
      const url = params.toString() ? `${BASE_URL}/bookings?${params.toString()}` : `${BASE_URL}/bookings`;
      
      const response = await fetch(url, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch bookings');
      }
      
      const bookings = await response.json();
      set({ bookings, isLoading: false });
    } catch (error: any) {
      console.error('Fetch bookings error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchBookingById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/bookings/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch booking');
      }
      
      const booking = await response.json();
      
      set(state => ({
        bookings: state.bookings.some(b => b.id === id)
          ? state.bookings.map(b => b.id === id ? booking : b)
          : [...state.bookings, booking],
        selectedBooking: booking,
        isLoading: false,
      }));
      
      return booking;
    } catch (error: any) {
      console.error('Fetch booking error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createBooking: async (data: Partial<DaycareBooking>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/bookings`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
      }
      
      const booking = await response.json();
      
      set(state => ({
        bookings: [booking, ...state.bookings],
        isLoading: false,
      }));
      
      broadcastMutation('daycare', 'booking', 'created', booking.id, undefined, booking.location_id);
      return booking;
    } catch (error: any) {
      console.error('Create booking error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  cancelBooking: async (id: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/bookings/${id}/cancel`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel booking');
      }
      
      const booking = await response.json();
      
      set(state => ({
        bookings: state.bookings.map(b => b.id === id ? booking : b),
        selectedBooking: state.selectedBooking?.id === id ? booking : state.selectedBooking,
        isLoading: false,
      }));
      
      broadcastMutation('daycare', 'booking', 'updated', id, { status: 'cancelled' }, booking.location_id);
      return booking;
    } catch (error: any) {
      console.error('Cancel booking error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  searchCustomers: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/search-customers?q=${encodeURIComponent(query)}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to search customers');
      }
      
      const customers = await response.json();
      set({ isLoading: false });
      return customers;
    } catch (error: any) {
      console.error('Search customers error:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },
  
  // ============================================================================
  // CHECK-IN / CHECK-OUT
  // ============================================================================
  
  validateCheckIn: async (bookingId: string) => {
    try {
      console.log('[Store] validateCheckIn called for booking:', bookingId);
      
      const response = await fetch(`${BASE_URL}/bookings/${bookingId}/validate-checkin`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[Store] validateCheckIn API error:', error);
        throw new Error(error.error || 'Failed to validate check-in');
      }
      
      const result = await response.json();
      console.log('[Store] validateCheckIn API result:', result);
      return result;
    } catch (error: any) {
      console.error('Validate check-in error:', error);
      throw error;
    }
  },
  
  checkIn: async (bookingId: string, data: { handover_notes?: string; warnings_acknowledged?: boolean }) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/bookings/${bookingId}/checkin`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check in');
      }
      
      const result = await response.json();
      
      set(state => ({
        bookings: state.bookings.map(b => b.id === bookingId ? result.booking : b),
        selectedBooking: state.selectedBooking?.id === bookingId ? result.booking : state.selectedBooking,
        attendance: [result.attendance, ...state.attendance],
        isLoading: false,
      }));
      
      broadcastMutation('daycare', 'attendance', 'created', bookingId, { action: 'check-in' }, result.booking?.location_id);
      return result;
    } catch (error: any) {
      console.error('Check-in error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  checkOut: async (bookingId: string, checkout_notes?: string, checkout_time?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/bookings/${bookingId}/checkout`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ checkout_notes, checkout_time }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check out');
      }
      
      const booking = await response.json();
      
      set(state => ({
        bookings: state.bookings.map(b => b.id === bookingId ? booking : b),
        selectedBooking: state.selectedBooking?.id === bookingId ? booking : state.selectedBooking,
        attendance: state.attendance.filter(a => a.booking_id !== bookingId),
        isLoading: false,
      }));
      
      broadcastMutation('daycare', 'attendance', 'updated', bookingId, { action: 'check-out' }, booking.location_id);
      return booking;
    } catch (error: any) {
      console.error('Check-out error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // ATTENDANCE
  // ============================================================================
  
  fetchActiveAttendance: async (locationId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const response = await fetch(`${BASE_URL}/attendance/active${params}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch attendance');
      }
      
      const attendance = await response.json();
      set({ attendance, isLoading: false });
    } catch (error: any) {
      console.error('Fetch attendance error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // STATS
  // ============================================================================
  
  fetchStats: async (locationId?: string, date?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (locationId) params.append('location_id', locationId);
      if (date) params.append('date', date);
      
      const url = params.toString() ? `${BASE_URL}/stats?${params.toString()}` : `${BASE_URL}/stats`;
      
      const headers = await getAuthHeaders();
      
      const response = await fetch(url, {
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch stats';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const stats = await response.json();
      set({ stats, isLoading: false });
    } catch (error: any) {
      console.error('Fetch stats error:', error);
      set({ error: error.message, isLoading: false });
      // Don't throw - allow UI to continue with error state
    }
  },
  
  fetchEvents: async (params) => {
    try {
      const urlParams = new URLSearchParams();
      if (params?.booking_id) urlParams.append('booking_id', params.booking_id);
      if (params?.location_id) urlParams.append('location_id', params.location_id);
      if (params?.limit) urlParams.append('limit', params.limit.toString());
      
      const url = urlParams.toString() ? `${BASE_URL}/events?${urlParams.toString()}` : `${BASE_URL}/events`;
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch events');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Fetch events error:', error);
      return [];
    }
  },
  
  // ============================================================================
  // FILTERS
  // ============================================================================
  
  setFilters: (filters: DaycareFilters) => {
    set({ filters });
  },
  
  clearFilters: () => {
    set({ filters: {} });
  },
  
  // ============================================================================
  // UI
  // ============================================================================
  
  setSelectedBooking: (booking: DaycareBooking | null) => {
    set({ selectedBooking: booking });
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    bookings: [],
    selectedBooking: null,
    attendance: [],
    stats: null,
    capacity: null,
    filters: {},
    isLoading: false,
    error: null,
  }),
}));