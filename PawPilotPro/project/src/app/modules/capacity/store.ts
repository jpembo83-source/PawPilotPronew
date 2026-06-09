// Capacity Store - Zustand state management
import { create } from 'zustand';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { projectId } from '../../../../utils/supabase/info';
import type { DailyCapacitySummary, ServiceCapacity, WeeklyCapacityView, CapacityFilters } from './types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

interface CapacityState {
  // Current view data
  weeklyView: WeeklyCapacityView | null;
  selectedDate: string;
  dailySummary: DailyCapacitySummary | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSelectedDate: (date: string) => void;
  fetchWeeklyCapacity: (startDate: string, locationId?: string) => Promise<void>;
  fetchDailyCapacity: (date: string, locationId?: string) => Promise<void>;
  
  // Utilities
  clearError: () => void;
}

// Helper to get week start (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Generate empty capacity for a service
function emptyServiceCapacity(service: ServiceCapacity['service'], date: string): ServiceCapacity {
  return {
    service,
    date,
    total_capacity: 0,
    booked: 0,
    available: 0,
    utilization_percent: 0,
    status: 'available'
  };
}

export const useCapacityStore = create<CapacityState>((set, get) => ({
  weeklyView: null,
  selectedDate: formatDate(new Date()),
  dailySummary: null,
  isLoading: false,
  error: null,

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().fetchDailyCapacity(date);
  },

  fetchWeeklyCapacity: async (startDate, locationId) => {
    set({ isLoading: true, error: null });
    
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ start_date: startDate });
      if (locationId && locationId !== 'ALL') {
        params.append('location_id', locationId);
      }

      const response = await fetch(`${API_BASE}/capacity/weekly?${params}`, { headers });
      
      if (!response.ok) {
        // Build mock weekly data when API doesn't exist
        const weekStart = getWeekStart(new Date(startDate));
        const days: DailyCapacitySummary[] = [];
        
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + i);
          const dateStr = formatDate(date);
          
          days.push({
            date: dateStr,
            daycare: emptyServiceCapacity('daycare', dateStr),
            grooming: emptyServiceCapacity('grooming', dateStr),
            overnights: emptyServiceCapacity('overnights', dateStr),
            transport: emptyServiceCapacity('transport', dateStr),
          });
        }

        set({
          weeklyView: {
            week_start: formatDate(weekStart),
            week_end: formatDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)),
            days
          },
          isLoading: false
        });
        return;
      }

      const data = await response.json();
      set({ weeklyView: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchDailyCapacity: async (date, locationId) => {
    set({ isLoading: true, error: null });
    
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ date });
      if (locationId && locationId !== 'ALL') {
        params.append('location_id', locationId);
      }

      const response = await fetch(`${API_BASE}/capacity/daily?${params}`, { headers });
      
      if (!response.ok) {
        // Empty data when API doesn't exist
        set({
          dailySummary: {
            date,
            daycare: emptyServiceCapacity('daycare', date),
            grooming: emptyServiceCapacity('grooming', date),
            overnights: emptyServiceCapacity('overnights', date),
            transport: emptyServiceCapacity('transport', date),
          },
          isLoading: false
        });
        return;
      }

      const data = await response.json();
      set({ dailySummary: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
