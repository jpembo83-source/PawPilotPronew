// Incidents Store - MDC Operations Centre
// Zustand store for incident reporting and management

import { create } from 'zustand';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { supabase } from '../../../utils/supabase/client';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/incidents`;

const getAuthHeaders = async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Session error:', sessionError);
    throw new Error('Authentication error. Please log in again.');
  }
  
  if (!session?.access_token) {
    throw new Error('Authentication required. Please log in.');
  }
  
  // Check if token is expired or expiring soon (within 5 minutes)
  const expiresAt = session.expires_at || 0;
  const now = Date.now() / 1000; // Convert to seconds
  const fiveMinutesFromNow = now + (5 * 60);
  
  if (expiresAt < fiveMinutesFromNow) {
    console.log('Token expired or expiring soon, refreshing session...');
    
    // Refresh the session
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshedSession) {
      console.error('Session refresh failed:', refreshError);
      throw new Error('Session expired. Please log in again.');
    }
    
    console.log('Session refreshed successfully');
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`, // ANON key for Supabase Edge Function invocation
      'X-User-Token': `Bearer ${refreshedSession.access_token}`, // User JWT for authentication within the function
    };
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`, // ANON key for Supabase Edge Function invocation
    'X-User-Token': `Bearer ${session.access_token}`, // User JWT for authentication within the function
  };
};

// ============================================================================
// TYPES
// ============================================================================

export type IncidentCategory = 
  | 'injury_dog'
  | 'injury_human'
  | 'behaviour'
  | 'escape'
  | 'illness'
  | 'property_damage'
  | 'transport'
  | 'overnight'
  | 'complaint'
  | 'near_miss'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 
  | 'new'
  | 'in_review'
  | 'action_required'
  | 'awaiting_customer'
  | 'resolved'
  | 'closed'
  | 'reopened';

export type IncidentModule = 'daycare' | 'grooming' | 'boutique' | 'transport' | 'overnights';

export interface Incident {
  id: string;
  location_id: string;
  location_name: string;
  module: IncidentModule;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  
  // Core details
  summary: string;
  description?: string;
  immediate_actions?: string;
  occurred_at: string;
  
  // Linked entities
  pet_id?: string;
  pet_name?: string;
  household_id?: string;
  household_name?: string;
  booking_id?: string;
  transport_id?: string;
  overnight_id?: string;
  
  // People involved
  created_by_id: string;
  created_by_name: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  
  // Workflow
  needs_follow_up: boolean;
  due_date?: string;
  escalated: boolean;
  escalated_at?: string;
  
  // Closure
  root_cause?: string;
  outcome_summary?: string;
  preventative_action?: string;
  closed_by_id?: string;
  closed_by_name?: string;
  closed_at?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  
  // Extended details (from API)
  people?: IncidentPerson[];
  actions?: IncidentAction[];
  notes?: IncidentNote[];
  attachments?: IncidentAttachment[];
  audit_logs?: IncidentAuditLog[];
}

export interface IncidentPerson {
  id: string;
  incident_id: string;
  user_id?: string;
  user_name: string;
  role: 'involved_staff' | 'witness' | 'reporter';
  notes?: string;
}

export interface IncidentAction {
  id: string;
  incident_id: string;
  description: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string;
  completed_by_id?: string;
  completed_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface IncidentNote {
  id: string;
  incident_id: string;
  content: string;
  author_id: string;
  author_name: string;
  is_internal: boolean;
  created_at: string;
}

export interface IncidentAttachment {
  id: string;
  incident_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface IncidentAuditLog {
  id: string;
  incident_id: string;
  action: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  user_id: string;
  user_name: string;
  user_role: string;
  timestamp: string;
  details?: any;
}

export interface IncidentStats {
  total: number;
  open: number;
  high_critical: number;
  overdue: number;
  assigned_to_me: number;
  by_severity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  by_status: {
    new: number;
    in_review: number;
    action_required: number;
    awaiting_customer: number;
    resolved: number;
    closed: number;
    reopened: number;
  };
  by_category: Record<string, number>;
  recent_30_days: number;
}

export interface IncidentFilters {
  location_id?: string;
  module?: IncidentModule;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  assigned_to_me?: boolean;
  open_only?: boolean;
  search?: string;
}

// ============================================================================
// STORE STATE
// ============================================================================

interface IncidentsState {
  // Data
  incidents: Incident[];
  selectedIncident: Incident | null;
  stats: IncidentStats | null;
  
  // Filters
  filters: IncidentFilters;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions - Incidents
  fetchIncidents: (filters?: IncidentFilters) => Promise<void>;
  fetchIncidentById: (id: string) => Promise<Incident | null>;
  createIncident: (data: Partial<Incident> & { involved_people?: Partial<IncidentPerson>[] }) => Promise<Incident>;
  updateIncident: (id: string, updates: Partial<Incident>) => Promise<Incident>;
  assignIncident: (id: string, data: { assigned_to_id: string; assigned_to_name: string; due_date?: string }) => Promise<Incident>;
  closeIncident: (id: string, data: { root_cause: string; outcome_summary: string; preventative_action?: string }) => Promise<Incident>;
  reopenIncident: (id: string, reason: string) => Promise<Incident>;
  
  // Actions - Notes
  addNote: (incidentId: string, content: string, isInternal?: boolean) => Promise<IncidentNote>;
  
  // Actions - Actions/Checklist
  addAction: (incidentId: string, data: { description: string; assigned_to_id?: string; assigned_to_name?: string; due_date?: string }) => Promise<IncidentAction>;
  updateAction: (incidentId: string, actionId: string, data: { status?: string; notes?: string }) => Promise<IncidentAction>;
  
  // Actions - Statistics
  fetchStats: (locationId?: string) => Promise<void>;
  
  // Actions - Export
  exportIncidents: () => Promise<Incident[]>;
  
  // Filters
  setFilters: (filters: IncidentFilters) => void;
  clearFilters: () => void;
  
  // UI
  setSelectedIncident: (incident: Incident | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useIncidentsStore = create<IncidentsState>((set, get) => ({
  // Initial State
  incidents: [],
  selectedIncident: null,
  stats: null,
  filters: {},
  isLoading: false,
  error: null,
  
  // ============================================================================
  // INCIDENTS
  // ============================================================================
  
  fetchIncidents: async (filters?: IncidentFilters) => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔍 Getting auth headers for incidents...');
      const headers = await getAuthHeaders();
      
      const params = new URLSearchParams();
      
      const currentFilters = filters || get().filters;
      
      if (currentFilters.location_id) params.append('location_id', currentFilters.location_id);
      if (currentFilters.module) params.append('module', currentFilters.module);
      if (currentFilters.severity) params.append('severity', currentFilters.severity);
      if (currentFilters.status) params.append('status', currentFilters.status);
      if (currentFilters.assigned_to_me) params.append('assigned_to_me', 'true');
      if (currentFilters.open_only) params.append('open_only', 'true');
      if (currentFilters.search) params.append('search', currentFilters.search);
      
      const url = params.toString() ? `${BASE_URL}?${params.toString()}` : BASE_URL;
      
      console.log('🔍 Fetching incidents:', {
        url,
        BASE_URL,
        headers: { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'missing' }
      });
      
      const response = await fetch(url, { headers });
      
      console.log('📥 Incidents response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers.get('content-type')
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          const text = await response.text();
          console.error('❌ Incidents response is not JSON:', text);
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text.substring(0, 200)}`);
        }
        console.error('❌ Fetch incidents API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `Failed to fetch incidents: ${response.statusText}`);
      }
      
      const incidents = await response.json();
      console.log('✅ Incidents fetched:', incidents.length);
      set({ incidents, isLoading: false });
    } catch (error: any) {
      console.error('❌ Fetch incidents error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      set({ error: error.message || 'Failed to fetch incidents', isLoading: false });
      throw error;
    }
  },
  
  fetchIncidentById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch incident');
      }
      
      const incident = await response.json();
      
      // Update in store
      set(state => ({
        incidents: state.incidents.some(i => i.id === id)
          ? state.incidents.map(i => i.id === id ? incident : i)
          : [...state.incidents, incident],
        selectedIncident: incident,
        isLoading: false,
      }));
      
      return incident;
    } catch (error: any) {
      console.error('Fetch incident by ID error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createIncident: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create incident');
      }
      
      const incident = await response.json();
      
      set(state => ({
        incidents: [incident, ...state.incidents],
        isLoading: false,
      }));
      
      return incident;
    } catch (error: any) {
      console.error('Create incident error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateIncident: async (id: string, updates: Partial<Incident>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update incident');
      }
      
      const incident = await response.json();
      
      set(state => ({
        incidents: state.incidents.map(i => i.id === id ? incident : i),
        selectedIncident: state.selectedIncident?.id === id ? incident : state.selectedIncident,
        isLoading: false,
      }));
      
      return incident;
    } catch (error: any) {
      console.error('Update incident error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  assignIncident: async (id: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}/assign`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign incident');
      }
      
      const incident = await response.json();
      
      set(state => ({
        incidents: state.incidents.map(i => i.id === id ? incident : i),
        selectedIncident: state.selectedIncident?.id === id ? incident : state.selectedIncident,
        isLoading: false,
      }));
      
      return incident;
    } catch (error: any) {
      console.error('Assign incident error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  closeIncident: async (id: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}/close`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close incident');
      }
      
      const incident = await response.json();
      
      set(state => ({
        incidents: state.incidents.map(i => i.id === id ? incident : i),
        selectedIncident: state.selectedIncident?.id === id ? incident : state.selectedIncident,
        isLoading: false,
      }));
      
      return incident;
    } catch (error: any) {
      console.error('Close incident error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  reopenIncident: async (id: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}/reopen`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reopen incident');
      }
      
      const incident = await response.json();
      
      set(state => ({
        incidents: state.incidents.map(i => i.id === id ? incident : i),
        selectedIncident: state.selectedIncident?.id === id ? incident : state.selectedIncident,
        isLoading: false,
      }));
      
      return incident;
    } catch (error: any) {
      console.error('Reopen incident error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // NOTES
  // ============================================================================
  
  addNote: async (incidentId: string, content: string, isInternal = true) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${incidentId}/notes`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ content, is_internal: isInternal }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add note');
      }
      
      const note = await response.json();
      
      // Refresh incident to get updated notes
      await get().fetchIncidentById(incidentId);
      
      set({ isLoading: false });
      return note;
    } catch (error: any) {
      console.error('Add note error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // ACTIONS
  // ============================================================================
  
  addAction: async (incidentId: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${incidentId}/actions`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add action');
      }
      
      const action = await response.json();
      
      // Refresh incident to get updated actions
      await get().fetchIncidentById(incidentId);
      
      set({ isLoading: false });
      return action;
    } catch (error: any) {
      console.error('Add action error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateAction: async (incidentId: string, actionId: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${incidentId}/actions/${actionId}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update action');
      }
      
      const action = await response.json();
      
      // Refresh incident to get updated actions
      await get().fetchIncidentById(incidentId);
      
      set({ isLoading: false });
      return action;
    } catch (error: any) {
      console.error('Update action error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // STATISTICS
  // ============================================================================
  
  fetchStats: async (locationId?: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔍 [INCIDENTS] Step 1: Getting auth headers...');
      const headers = await getAuthHeaders();
      
      const url = locationId 
        ? `${BASE_URL}/stats?location_id=${locationId}` 
        : `${BASE_URL}/stats`;
      
      console.log('🔍 [INCIDENTS] Step 2: About to fetch stats:', {
        url,
        BASE_URL,
        projectId,
        locationId,
        headers: { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'MISSING!' },
      });
      
      console.log('🔍 [INCIDENTS] Step 3: Calling fetch...');
      const response = await fetch(url, { headers });
      
      console.log('📥 [INCIDENTS] Step 4: Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        url: response.url
      });
      
      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get('content-type');
        console.log('❌ [INCIDENTS] Response not OK, content-type:', contentType);
        
        try {
          if (contentType?.includes('application/json')) {
            errorData = await response.json();
            console.log('❌ [INCIDENTS] Error data parsed:', errorData);
          } else {
            const text = await response.text();
            console.error('❌ [INCIDENTS] Response is not JSON, got text:', text.substring(0, 500));
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text.substring(0, 200)}`);
          }
        } catch (e) {
          console.error('❌ [INCIDENTS] Failed to parse error response:', e);
          const text = await response.text().catch(() => '(unable to read response text)');
          console.error('❌ [INCIDENTS] Response text:', text.substring(0, 500));
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text.substring(0, 200)}`);
        }
        throw new Error(errorData.error || `Failed to fetch statistics: ${response.statusText}`);
      }
      
      console.log('🔍 [INCIDENTS] Step 5: Parsing successful response JSON...');
      const stats = await response.json();
      console.log('✅ [INCIDENTS] Step 6: Stats fetched successfully:', stats);
      set({ stats, isLoading: false });
    } catch (error: any) {
      console.error('❌ [INCIDENTS] FATAL ERROR in fetchStats:', error);
      console.error('❌ [INCIDENTS] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        type: typeof error,
        constructorName: error.constructor?.name
      });
      set({ error: error.message || 'Failed to fetch stats', isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // EXPORT
  // ============================================================================
  
  exportIncidents: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/export`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export incidents');
      }
      
      const data = await response.json();
      set({ isLoading: false });
      return data;
    } catch (error: any) {
      console.error('Export incidents error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // FILTERS
  // ============================================================================
  
  setFilters: (filters: IncidentFilters) => {
    set({ filters });
  },
  
  clearFilters: () => {
    set({ filters: {} });
  },
  
  // ============================================================================
  // UI
  // ============================================================================
  
  setSelectedIncident: (incident: Incident | null) => {
    set({ selectedIncident: incident });
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    incidents: [],
    selectedIncident: null,
    stats: null,
    filters: {},
    isLoading: false,
    error: null,
  }),
}));