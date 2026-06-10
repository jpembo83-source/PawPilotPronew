// Staff Management Store - Zustand
// Manages state for staff, policies, and rotas

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import type {
  StaffMember,
  StaffProfile,
  Policy,
  PolicyVersion,
  PolicyAssignment,
  PolicyAcknowledgement,
  AssignedPolicyView,
  RotaPeriod,
  RotaShift,
  StaffFilters,
  PolicyFilters,
  AssignmentFilters,
  RotaFilters,
  CreatePolicyRequest,
  AssignPolicyRequest,
  AcknowledgePolicyRequest,
  CreateRotaPeriodRequest,
  CreateRotaShiftRequest,
  UpdateRotaShiftRequest,
} from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff`;

interface StaffState {
  // Staff Management
  staff: StaffMember[];
  selectedStaff: StaffProfile | null;
  staffFilters: StaffFilters;
  
  // Policies
  policies: Policy[];
  selectedPolicy: Policy | null;
  policyVersions: PolicyVersion[];
  policyFilters: PolicyFilters;
  
  // Assignments
  assignments: PolicyAssignment[];
  selectedAssignment: PolicyAssignment | null;
  assignmentFilters: AssignmentFilters;
  
  // My Policies (staff view)
  myPolicies: AssignedPolicyView[];
  
  // Rotas
  rotas: RotaPeriod[];
  selectedRota: RotaPeriod | null;
  rotaShifts: RotaShift[];
  rotaFilters: RotaFilters;
  
  // My Rota (staff view)
  myRota: RotaShift[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // ============================================================================
  // STAFF MANAGEMENT
  // ============================================================================
  
  fetchStaff: (filters?: StaffFilters) => Promise<void>;
  fetchStaffById: (id: string) => Promise<void>;
  setStaffFilters: (filters: StaffFilters) => void;
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  fetchPolicies: (filters?: PolicyFilters) => Promise<void>;
  fetchPolicyById: (id: string) => Promise<void>;
  createPolicy: (data: CreatePolicyRequest) => Promise<Policy>;
  createPolicyVersion: (policyId: string, file: File, data: any) => Promise<PolicyVersion>;
  publishPolicy: (id: string) => Promise<Policy>;
  archivePolicy: (id: string) => Promise<Policy>;
  getPolicyDownloadUrl: (policyId: string, versionId: string) => Promise<string>;
  deletePolicy: (id: string) => Promise<void>;
  setPolicyFilters: (filters: PolicyFilters) => void;
  
  // ============================================================================
  // POLICY ASSIGNMENTS
  // ============================================================================
  
  fetchAssignments: (filters?: AssignmentFilters) => Promise<void>;
  fetchAssignmentById: (id: string) => Promise<void>;
  assignPolicy: (data: AssignPolicyRequest) => Promise<PolicyAssignment>;
  setAssignmentFilters: (filters: AssignmentFilters) => void;
  
  // ============================================================================
  // POLICY ACKNOWLEDGEMENTS (STAFF VIEW)
  // ============================================================================
  
  fetchMyPolicies: () => Promise<void>;
  acknowledgePolicy: (data: AcknowledgePolicyRequest) => Promise<PolicyAcknowledgement>;
  
  // ============================================================================
  // ROTAS
  // ============================================================================
  
  fetchRotas: (filters?: RotaFilters) => Promise<void>;
  fetchRotaById: (id: string) => Promise<void>;
  createRota: (data: CreateRotaPeriodRequest) => Promise<RotaPeriod>;
  publishRota: (id: string) => Promise<RotaPeriod>;
  setRotaFilters: (filters: RotaFilters) => void;
  
  // Shifts
  createShift: (rotaId: string, data: CreateRotaShiftRequest) => Promise<RotaShift>;
  updateShift: (rotaId: string, shiftId: string, data: UpdateRotaShiftRequest) => Promise<RotaShift>;
  deleteShift: (rotaId: string, shiftId: string) => Promise<void>;
  
  // My Rota (staff view)
  fetchMyRota: () => Promise<void>;
  
  // ============================================================================
  // UTILITY
  // ============================================================================
  
  seedDemoData: () => Promise<any>;
  cleanupAllData: () => Promise<any>;
  resetAndSeed: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useStaffStore = create<StaffState>((set, get) => ({
  // Initial State
  staff: [],
  selectedStaff: null,
  staffFilters: {},
  
  policies: [],
  selectedPolicy: null,
  policyVersions: [],
  policyFilters: {},
  
  assignments: [],
  selectedAssignment: null,
  assignmentFilters: {},
  
  myPolicies: [],
  
  rotas: [],
  selectedRota: null,
  rotaShifts: [],
  rotaFilters: {},
  
  myRota: [],
  
  isLoading: false,
  error: null,
  
  // ============================================================================
  // STAFF MANAGEMENT
  // ============================================================================
  
  fetchStaff: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        set({ isLoading: false });
        return; // Silently skip if not authenticated
      }
      
      const params = new URLSearchParams();
      const currentFilters = filters || get().staffFilters;
      
      if (currentFilters.search) params.append('search', currentFilters.search);
      if (currentFilters.role) params.append('role', currentFilters.role);
      if (currentFilters.location_id) params.append('location_id', currentFilters.location_id);
      if (currentFilters.status) params.append('status', currentFilters.status);
      
      const url = params.toString() ? `${BASE_URL}?${params.toString()}` : BASE_URL;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch staff');
      }
      
      const staff = await response.json();
      set({ staff, isLoading: false });
    } catch (error: any) {
      console.error('Fetch staff error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchStaffById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      const response = await fetch(`${BASE_URL}/${id}`, {
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch staff member');
      }
      
      const staff = await response.json();
      set({ selectedStaff: staff, isLoading: false });
    } catch (error: any) {
      console.error('Fetch staff member error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  setStaffFilters: (filters) => {
    set({ staffFilters: filters });
  },
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  fetchPolicies: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        set({ isLoading: false });
        return; // Silently skip if not authenticated
      }
      
      const params = new URLSearchParams();
      const currentFilters = filters || get().policyFilters;
      
      if (currentFilters.search) params.append('search', currentFilters.search);
      if (currentFilters.category) params.append('category', currentFilters.category);
      if (currentFilters.status) params.append('status', currentFilters.status);
      
      const url = params.toString() ? `${BASE_URL}/policies?${params.toString()}` : `${BASE_URL}/policies`;
      
      console.log('[fetchPolicies] Fetching from:', url);
      
      const response = await fetch(url, { headers });
      
      console.log('[fetchPolicies] Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        // Don't throw error for 404 - just return empty array
        if (response.status === 404) {
          console.log('[Fetch Policies] No policies found, returning empty array');
          set({ policies: [], isLoading: false, error: null });
          return;
        }
        throw new Error(error.error || 'Failed to fetch policies');
      }
      
      const policies = await response.json();
      console.log('[fetchPolicies] Received policies:', policies.length);
      console.log('[fetchPolicies] Policy IDs:', policies.map((p: any) => p.id));
      
      set({ policies, isLoading: false });
    } catch (error: any) {
      console.error('Fetch policies error:', error);
      // Don't show error for empty results - just set empty array
      if (error.message?.includes('not found') || error.message?.includes('Staff member not found')) {
        set({ policies: [], isLoading: false, error: null });
      } else {
        set({ error: error.message, isLoading: false });
      }
    }
  },
  
  fetchPolicyById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      const response = await fetch(`${BASE_URL}/policies/${id}`, {
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch policy');
      }
      
      const policy = await response.json();
      set({ 
        selectedPolicy: policy,
        policyVersions: policy.versions || [],
        isLoading: false 
      });
    } catch (error: any) {
      console.error('Fetch policy error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  createPolicy: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      const response = await fetch(`${BASE_URL}/policies`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create policy');
      }
      
      const policy = await response.json();
      set(state => ({
        policies: [policy, ...state.policies],
        isLoading: false,
      }));

      broadcastMutation('staff', 'policy', 'created')

      return policy;
    } catch (error: any) {
      console.error('Create policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  publishPolicy: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      const response = await fetch(`${BASE_URL}/policies/${id}/publish`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish policy');
      }
      
      const policy = await response.json();
      set(state => ({
        policies: state.policies.map(p => p.id === id ? { ...p, ...policy } : p),
        isLoading: false,
      }));
      
      return policy;
    } catch (error: any) {
      console.error('Publish policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  archivePolicy: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      const response = await fetch(`${BASE_URL}/policies/${id}/archive`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to archive policy');
      }
      
      const policy = await response.json();
      set(state => ({
        policies: state.policies.map(p => p.id === id ? { ...p, ...policy } : p),
        isLoading: false,
      }));
      
      return policy;
    } catch (error: any) {
      console.error('Archive policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createPolicyVersion: async (policyId, file, data) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      console.log('[createPolicyVersion] Starting upload for policy:', policyId);
      console.log('[createPolicyVersion] File:', file?.name, file?.size, file?.type);
      
      // Step 1: Create version and get upload URL
      const createResponse = await fetch(`${BASE_URL}/policies/${policyId}/versions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          effective_date: data.effective_date,
          expiry_date: data.expiry_date,
        }),
      });
      
      console.log('[createPolicyVersion] Create response status:', createResponse.status);
      
      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error('[createPolicyVersion] Create failed:', error);
        throw new Error(error.error || 'Failed to create policy version');
      }
      
      const { version, upload_url, upload_token, upload_path } = await createResponse.json();
      console.log('[createPolicyVersion] Version created:', version.id);
      console.log('[createPolicyVersion] Upload URL received');
      
      // Step 2: Upload file to Supabase Storage
      console.log('[createPolicyVersion] Uploading file to storage...');
      
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
      });
      
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        console.error('[createPolicyVersion] Upload failed:', uploadError);
        throw new Error(`File upload failed: ${uploadError}`);
      }
      
      console.log('[createPolicyVersion] File uploaded successfully');

      set({ isLoading: false });
      broadcastMutation('staff', 'policy', 'updated')

      return version;
    } catch (error: any) {
      console.error('Create policy version error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  getPolicyDownloadUrl: async (policyId, versionId) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      const response = await fetch(
        `${BASE_URL}/policies/${policyId}/versions/${versionId}/download`,
        {
          headers,
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download URL');
      }
      
      const { download_url } = await response.json();
      return download_url;
    } catch (error: any) {
      console.error('Get download URL error:', error);
      throw error;
    }
  },
  
  deletePolicy: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      const response = await fetch(`${BASE_URL}/policies/${id}`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete policy');
      }
      
      set(state => ({
        policies: state.policies.filter(p => p.id !== id),
        isLoading: false,
      }));
      broadcastMutation('staff', 'policy', 'deleted', id);
    } catch (error: any) {
      console.error('Delete policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  setPolicyFilters: (filters) => {
    set({ policyFilters: filters });
  },
  
  // ============================================================================
  // POLICY ASSIGNMENTS
  // ============================================================================
  
  fetchAssignments: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        set({ isLoading: false });
        return; // Silently skip if not authenticated
      }
      
      const params = new URLSearchParams();
      const currentFilters = filters || get().assignmentFilters;
      
      if (currentFilters.policy_id) params.append('policy_id', currentFilters.policy_id);
      if (currentFilters.user_id) params.append('user_id', currentFilters.user_id);
      
      const url = params.toString() 
        ? `${BASE_URL}/policies/assignments?${params.toString()}` 
        : `${BASE_URL}/policies/assignments`;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        // Don't throw error for 404 - just return empty array
        if (response.status === 404) {
          console.log('[Fetch Assignments] No assignments found, returning empty array');
          set({ assignments: [], isLoading: false, error: null });
          return;
        }
        throw new Error(error.error || 'Failed to fetch assignments');
      }
      
      const assignments = await response.json();
      set({ assignments, isLoading: false });
    } catch (error: any) {
      console.error('Fetch assignments error:', error);
      // Don't show error for empty results - just set empty array
      if (error.message?.includes('not found') || error.message?.includes('Policy not found') || error.message?.includes('Staff member not found')) {
        set({ assignments: [], isLoading: false, error: null });
      } else {
        set({ error: error.message, isLoading: false });
      }
    }
  },
  
  fetchAssignmentById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/policies/assignments/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch assignment');
      }
      
      const assignment = await response.json();
      set({ selectedAssignment: assignment, isLoading: false });
    } catch (error: any) {
      console.error('Fetch assignment error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  assignPolicy: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Not authenticated - please log in');
      }
      
      console.log('[assignPolicy] Assigning policy with data:', {
        policy_id: data.policy_id,
        policy_version_id: data.policy_version_id,
        targets: data.targets,
        due_date: data.due_date,
      });
      
      const response = await fetch(`${BASE_URL}/policies/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      console.log('[assignPolicy] Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[assignPolicy] Error response:', error);
        throw new Error(error.error || 'Failed to assign policy');
      }
      
      const assignment = await response.json();
      console.log('[assignPolicy] Assignment created:', assignment);
      
      set(state => ({
        assignments: [assignment, ...state.assignments],
        isLoading: false,
      }));

      broadcastMutation('staff', 'policy-assignment', 'created')

      return assignment;
    } catch (error: any) {
      console.error('Assign policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  setAssignmentFilters: (filters) => {
    set({ assignmentFilters: filters });
  },
  
  // ============================================================================
  // POLICY ACKNOWLEDGEMENTS (STAFF VIEW)
  // ============================================================================
  
  fetchMyPolicies: async () => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      
      console.log('[fetchMyPolicies] Auth headers:', {
        hasHeaders: !!headers,
        headers: headers ? Object.keys(headers) : [],
      });
      
      if (!headers) {
        throw new Error('Authentication required - please log in');
      }
      
      const url = `${BASE_URL}/my-policies`;
      console.log('[fetchMyPolicies] Fetching from:', url);
      
      const response = await fetch(url, { headers });
      
      console.log('[fetchMyPolicies] Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[fetchMyPolicies] Error response:', error);
        throw new Error(error.error || 'Failed to fetch policies');
      }
      
      const policies = await response.json();
      console.log('[fetchMyPolicies] Received policies:', policies.length);
      console.log('[fetchMyPolicies] Policy titles:', policies.map((p: any) => p.policy_title));
      
      set({ myPolicies: policies, isLoading: false });
    } catch (error: any) {
      console.error('[fetchMyPolicies] Error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  acknowledgePolicy: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/policies/acknowledge`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to acknowledge policy');
      }
      
      const acknowledgement = await response.json();
      
      // Update my policies list
      set(state => ({
        myPolicies: state.myPolicies.map(p =>
          p.assignment_id === data.assignment_id
            ? { ...p, status: 'acknowledged' as const, acknowledgement }
            : p
        ),
        isLoading: false,
      }));

      broadcastMutation('staff', 'policy', 'updated')

      return acknowledgement;
    } catch (error: any) {
      console.error('Acknowledge policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // ROTAS
  // ============================================================================
  
  fetchRotas: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        set({ isLoading: false });
        return; // Silently skip if not authenticated
      }
      
      const params = new URLSearchParams();
      const currentFilters = filters || get().rotaFilters;
      
      if (currentFilters.location_id) params.append('location_id', currentFilters.location_id);
      if (currentFilters.start_date) params.append('start_date', currentFilters.start_date);
      if (currentFilters.end_date) params.append('end_date', currentFilters.end_date);
      
      const url = params.toString() 
        ? `${BASE_URL}/rotas?${params.toString()}` 
        : `${BASE_URL}/rotas`;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch rotas');
      }
      
      const rotas = await response.json();
      set({ rotas, isLoading: false });
    } catch (error: any) {
      console.error('Fetch rotas error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchRotaById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/rotas/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch rota');
      }
      
      const rota = await response.json();
      set({ 
        selectedRota: rota,
        rotaShifts: rota.shifts || [],
        isLoading: false 
      });
    } catch (error: any) {
      console.error('Fetch rota error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  createRota: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/rotas`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create rota');
      }
      
      const rota = await response.json();
      set(state => ({
        rotas: [rota, ...state.rotas],
        isLoading: false,
      }));

      broadcastMutation('staff', 'rota', 'created')

      return rota;
    } catch (error: any) {
      console.error('Create rota error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  publishRota: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/rotas/${id}/publish`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish rota');
      }
      
      const rota = await response.json();
      set(state => ({
        rotas: state.rotas.map(r => r.id === id ? rota : r),
        selectedRota: state.selectedRota?.id === id ? rota : state.selectedRota,
        isLoading: false,
      }));
      
      return rota;
    } catch (error: any) {
      console.error('Publish rota error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  setRotaFilters: (filters) => {
    set({ rotaFilters: filters });
  },
  
  // ============================================================================
  // SHIFTS
  // ============================================================================
  
  createShift: async (rotaId, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/rotas/${rotaId}/shifts`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create shift');
      }
      
      const shift = await response.json();
      set(state => ({
        rotaShifts: [...state.rotaShifts, shift],
        isLoading: false,
      }));

      broadcastMutation('staff', 'shift', 'created')

      return shift;
    } catch (error: any) {
      console.error('Create shift error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateShift: async (rotaId, shiftId, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/rotas/${rotaId}/shifts/${shiftId}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update shift');
      }
      
      const shift = await response.json();
      set(state => ({
        rotaShifts: state.rotaShifts.map(s => s.id === shiftId ? shift : s),
        isLoading: false,
      }));

      broadcastMutation('staff', 'shift', 'updated', shiftId)

      return shift;
    } catch (error: any) {
      console.error('Update shift error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteShift: async (rotaId, shiftId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/rotas/${rotaId}/shifts/${shiftId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete shift');
      }
      
      set(state => ({
        rotaShifts: state.rotaShifts.filter(s => s.id !== shiftId),
        isLoading: false,
      }));
      broadcastMutation('staff', 'shift', 'deleted', shiftId);
    } catch (error: any) {
      console.error('Delete shift error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // MY ROTA (STAFF VIEW)
  // ============================================================================
  
  fetchMyRota: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/my-rota`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch rota');
      }
      
      const shifts = await response.json();
      set({ myRota: shifts, isLoading: false });
    } catch (error: any) {
      console.error('Fetch my rota error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  // ============================================================================
  // UTILITY
  // ============================================================================
  
  seedDemoData: async () => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${BASE_URL}/seed-demo`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to seed demo data');
      }
      
      const result = await response.json();
      console.log('[Staff Store] Demo data seeded:', result);
      return result;
    } catch (error: any) {
      console.error('Seed demo data error:', error);
      throw error;
    }
  },
  
  cleanupAllData: async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Must be authenticated to cleanup data');
      }
      
      const response = await fetch(`${BASE_URL}/cleanup`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cleanup data');
      }
      
      const result = await response.json();
      console.log('[Staff Store] Data cleaned up:', result);
      
      // Reset local state
      set({
        staff: [],
        policies: [],
        assignments: [],
        rotas: [],
        myPolicies: [],
        myRota: [],
      });
      
      return result;
    } catch (error: any) {
      console.error('Cleanup error:', error);
      throw error;
    }
  },
  
  resetAndSeed: async () => {
    try {
      // First cleanup
      await get().cleanupAllData();
      
      // Then seed
      await get().seedDemoData();
      
      // Refresh all data
      await get().fetchStaff();
      await get().fetchPolicies();
      await get().fetchAssignments();
      
      console.log('[Staff Store] Reset and seed complete');
    } catch (error: any) {
      console.error('Reset and seed error:', error);
      throw error;
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    staff: [],
    selectedStaff: null,
    staffFilters: {},
    policies: [],
    selectedPolicy: null,
    policyVersions: [],
    policyFilters: {},
    assignments: [],
    selectedAssignment: null,
    assignmentFilters: {},
    myPolicies: [],
    rotas: [],
    selectedRota: null,
    rotaShifts: [],
    rotaFilters: {},
    myRota: [],
    isLoading: false,
    error: null,
  }),
}));