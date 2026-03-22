/**
 * Transport Store - Production-grade with backend integration
 * NO SEED/MOCK DATA - All operations use real Supabase backend
 * British English throughout with full tenant isolation
 */

import { create } from 'zustand';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { supabase } from '../../../utils/supabase/client';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import type {
  TransportJob,
  TransportJobWithDetails,
  Vehicle,
  CreateTransportJobRequest,
  UpdateTransportJobRequest
} from './types';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

interface TransportState {
  // Data
  jobs: TransportJobWithDetails[];
  vehicles: Vehicle[];
  
  // Driver assignment configuration
  activeDriverCount: number | null;
  activeVehicleCount: number | null;
  activeDrivers: any[];
  activeVehicles: any[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions - Transport Jobs
  fetchJobs: (filters?: {
    location_id?: string;
    service_date?: string;
    status?: string;
    driver_user_id?: string;
  }) => Promise<void>;
  
  // Fetch active driver count for a location
  fetchActiveDrivers: (locationId?: string) => Promise<void>;
  
  createJob: (data: CreateTransportJobRequest) => Promise<void>;
  updateJob: (jobId: string, updates: UpdateTransportJobRequest) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  assignDriver: (jobId: string, driverUserId: string | undefined, vehicleId: string) => Promise<void>;
  updateJobStatus: (jobId: string, eventType: string, notes?: string) => Promise<void>;
  
  // Actions - Vehicles
  fetchVehicles: (locationId?: string) => Promise<void>;
  createVehicle: (data: Omit<Vehicle, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateVehicle: (vehicleId: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (vehicleId: string) => Promise<void>;
  
  // Helpers
  clearError: () => void;
  reset: () => void;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.access_token) {
    throw new Error('Authentication required. Please log in.');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-User-Token': `Bearer ${session.access_token}`,
  };
}

export const useTransportStore = create<TransportState>()((set, get) => ({
  // Initial state
  jobs: [],
  vehicles: [],
  activeDriverCount: null,
  activeVehicleCount: null,
  activeDrivers: [],
  activeVehicles: [],
  isLoading: false,
  error: null,
  
  // ============================================================================
  // TRANSPORT JOBS
  // ============================================================================
  
  fetchJobs: async (filters = {}) => {
    set({ isLoading: true, error: null });
    console.log('[Transport Store] fetchJobs called with filters:', filters);
    try {
      const params = new URLSearchParams();
      if (filters.location_id) params.append('location_id', filters.location_id);
      if (filters.service_date) params.append('service_date', filters.service_date);
      if (filters.status) params.append('status', filters.status);
      if (filters.driver_user_id) params.append('driver_user_id', filters.driver_user_id);
      
      const headers = await getAuthHeaders();
      const url = `${API_URL}/transport/jobs?${params}`;
      console.log('[Transport Store] Fetching from URL:', url);
      const response = await fetch(url, {
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch transport jobs' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Transport Store] Received jobs:', data.jobs);
      set({ jobs: data.jobs || [], isLoading: false });
    } catch (error: any) {
      console.error('Error fetching transport jobs:', error);
      set({ error: error.message, isLoading: false, jobs: [] });
    }
  },
  
  createJob: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create transport job' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      await get().fetchJobs({ service_date: data.service_date, location_id: data.location_id });
      
      broadcastMutation('transport', 'job', 'created', result.job?.id);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('Error creating transport job:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateJob: async (jobId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/jobs/${jobId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update transport job' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      set(state => ({
        jobs: state.jobs.map(j => j.id === jobId ? { ...j, ...result.job } : j),
        isLoading: false
      }));
      broadcastMutation('transport', 'job', 'updated', jobId);
    } catch (error: any) {
      console.error('Error updating transport job:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteJob: async (jobId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/jobs/${jobId}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete transport job' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      set(state => ({
        jobs: state.jobs.filter(j => j.id !== jobId),
        isLoading: false
      }));
      broadcastMutation('transport', 'job', 'deleted', jobId);
    } catch (error: any) {
      console.error('Error deleting transport job:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  assignDriver: async (jobId, driverUserId, vehicleId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/jobs/${jobId}/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ driver_user_id: driverUserId, vehicle_id: vehicleId })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to assign driver' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      set(state => ({
        jobs: state.jobs.map(j => j.id === jobId ? { ...j, ...result.job } : j),
        isLoading: false
      }));
      broadcastMutation('transport', 'job', 'updated', jobId, { action: 'driver-assigned' });
    } catch (error: any) {
      console.error('Error assigning driver:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateJobStatus: async (jobId, eventType, notes) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/jobs/${jobId}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ event_type: eventType, notes })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update job status' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      set(state => ({
        jobs: state.jobs.map(j => j.id === jobId ? { ...j, ...result.job } : j),
        isLoading: false
      }));
      broadcastMutation('transport', 'job', 'updated', jobId, { action: 'status-change', eventType });
    } catch (error: any) {
      console.error('Error updating job status:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Fetch active driver count for a location
  fetchActiveDrivers: async (locationId) => {
    set({ isLoading: true, error: null });
    console.log('[Transport Store] fetchActiveDrivers called with location:', locationId);
    try {
      const params = new URLSearchParams();
      if (locationId) params.append('location_id', locationId);
      
      const headers = await getAuthHeaders();
      const url = `${API_URL}/transport/active-drivers?${params}`;
      console.log('[Transport Store] Fetching active drivers from:', url);
      
      const response = await fetch(url, {
        headers
      });
      
      console.log('[Transport Store] Active drivers response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch active drivers' }));
        console.error('[Transport Store] Active drivers error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Transport Store] Active drivers data:', data);
      
      set({ 
        activeDrivers: data.drivers || [], 
        activeDriverCount: data.driver_count || 0,
        activeVehicles: data.vehicles || [],
        activeVehicleCount: data.vehicle_count || 0,
        isLoading: false 
      });
    } catch (error: any) {
      console.error('[Transport Store] Error fetching active drivers:', error);
      // Set count to 0 on error so UI shows "No drivers configured" instead of "Loading..."
      set({ error: error.message, isLoading: false, activeDrivers: [], activeDriverCount: 0 });
    }
  },
  
  // ============================================================================
  // VEHICLES
  // ============================================================================
  
  fetchVehicles: async (locationId) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (locationId) params.append('location_id', locationId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/vehicles?${params}`, {
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch vehicles' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      set({ vehicles: data.vehicles || [], isLoading: false });
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      set({ error: error.message, isLoading: false, vehicles: [] });
    }
  },
  
  createVehicle: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/vehicles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create vehicle' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      await get().fetchVehicles(data.location_id);
      
      broadcastMutation('transport', 'vehicle', 'created', result.vehicle?.id);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('Error creating vehicle:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateVehicle: async (vehicleId, updates) => {
    set({ isLoading: true, error: null });
    try {
      console.log('[Transport Store] updateVehicle called with:', { vehicleId, updates });
      const headers = await getAuthHeaders();
      const url = `${API_URL}/transport/vehicles/${vehicleId}`;
      console.log('[Transport Store] Updating vehicle at URL:', url);
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Transport Store] Update vehicle failed. Status:', response.status, 'Response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `Failed to update vehicle (HTTP ${response.status})` };
        }
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[Transport Store] Vehicle updated successfully:', result);
      
      set(state => ({
        vehicles: state.vehicles.map(v => v.id === vehicleId ? result.vehicle : v),
        isLoading: false
      }));
      broadcastMutation('transport', 'vehicle', 'updated', vehicleId);
    } catch (error: any) {
      console.error('[Transport Store] Error updating vehicle:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteVehicle: async (vehicleId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/transport/vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete vehicle' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      set(state => ({
        vehicles: state.vehicles.filter(v => v.id !== vehicleId),
        isLoading: false
      }));
      broadcastMutation('transport', 'vehicle', 'deleted', vehicleId);
    } catch (error: any) {
      console.error('Error deleting vehicle:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    jobs: [],
    vehicles: [],
    activeDriverCount: null,
    activeVehicleCount: null,
    activeDrivers: [],
    activeVehicles: [],
    isLoading: false,
    error: null
  })
}));