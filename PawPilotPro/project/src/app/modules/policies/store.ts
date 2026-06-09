// Policies Store - MDC Operations Centre
// Zustand store for policy compliance operations

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/policies`;

// ============================================================================
// TYPES
// ============================================================================

export type PolicyStatus = 'draft' | 'published' | 'archived';
export type AssignmentStatus = 'pending' | 'viewed' | 'acknowledged' | 'overdue';
export type FileType = 'pdf' | 'doc' | 'docx';

export interface PolicyDocument {
  id: string;
  title: string;
  category?: string;
  version: string;
  file_url: string;
  file_type: FileType;
  file_name: string;
  file_size: number;
  status: PolicyStatus;
  description?: string;
  effective_date?: string;
  location_ids?: string[];
  requires_reacknowledgement: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  published_at?: string;
  archived_at?: string;
  previous_version_id?: string;
}

export interface PolicyAssignment {
  id: string;
  policy_id: string;
  policy_title: string;
  policy_version: string;
  assigned_to_user_id: string;
  assigned_to_name: string;
  assigned_to_email: string;
  assigned_by_user_id: string;
  assigned_by_name: string;
  due_date: string;
  status: AssignmentStatus;
  location_scope?: string[];
  role_scope?: string[];
  is_blocking: boolean;
  assignment_type: 'individual' | 'location' | 'role' | 'organisation';
  created_at: string;
}

export interface PolicyAcknowledgement {
  id: string;
  assignment_id: string;
  policy_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  acknowledged_at: string;
  viewed_at?: string;
  ip_address?: string;
  user_agent?: string;
  signature_data: string;
}

export interface ComplianceStats {
  total_policies: number;
  total_assignments: number;
  acknowledged: number;
  overdue: number;
  pending: number;
  viewed: number;
  completion_rate: number;
  due_soon: number;
}

export interface PolicyCompliance {
  policy_id: string;
  policy_title: string;
  policy_version: string;
  total_assignments: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  completion_rate: number;
}

export interface AuditLog {
  id: string;
  action: 'upload' | 'publish' | 'archive' | 'assign' | 'acknowledge' | 'export' | 'reminder_sent' | 'view';
  entity_type: 'policy' | 'assignment' | 'acknowledgement';
  entity_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  details: any;
  timestamp: string;
  ip_address?: string;
}

// ============================================================================
// STORE STATE
// ============================================================================

interface PoliciesState {
  // Data
  policies: PolicyDocument[];
  myAssignments: PolicyAssignment[];
  allAssignments: PolicyAssignment[];
  acknowledgements: PolicyAcknowledgement[];
  complianceStats: ComplianceStats | null;
  policyCompliance: PolicyCompliance[];
  auditLogs: AuditLog[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions - Policies
  fetchPolicies: () => Promise<void>;
  fetchPolicyById: (id: string) => Promise<PolicyDocument | null>;
  createPolicy: (policy: Partial<PolicyDocument>) => Promise<PolicyDocument>;
  publishPolicy: (id: string) => Promise<PolicyDocument>;
  archivePolicy: (id: string) => Promise<PolicyDocument>;
  
  // Actions - Assignments (Staff View)
  fetchMyAssignments: () => Promise<void>;
  acknowledgeAssignment: (assignmentId: string, viewedAt?: string) => Promise<PolicyAcknowledgement>;
  markAsViewed: (assignmentId: string) => Promise<void>;
  
  // Actions - Assignments (Manager/Admin View)
  fetchAllAssignments: () => Promise<void>;
  fetchPolicyAssignments: (policyId: string) => Promise<PolicyAssignment[]>;
  createAssignments: (data: {
    policy_id: string;
    user_ids: string[];
    due_date: string;
    location_scope?: string[];
    role_scope?: string[];
    is_blocking?: boolean;
    assignment_type?: 'individual' | 'location' | 'role' | 'organisation';
  }) => Promise<PolicyAssignment[]>;
  
  // Actions - Acknowledgements
  fetchAcknowledgements: (policyId: string) => Promise<void>;
  
  // Actions - Compliance
  fetchComplianceStats: () => Promise<void>;
  fetchPolicyCompliance: () => Promise<void>;
  
  // Actions - Audit
  fetchAuditLogs: () => Promise<void>;
  
  // Actions - Export
  exportAcknowledgements: () => Promise<PolicyAcknowledgement[]>;
  exportAssignments: () => Promise<PolicyAssignment[]>;
  
  // Actions - Storage
  getDownloadUrl: (policyId: string) => Promise<string>;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const usePoliciesStore = create<PoliciesState>((set, get) => ({
  // Initial State
  policies: [],
  myAssignments: [],
  allAssignments: [],
  acknowledgements: [],
  complianceStats: null,
  policyCompliance: [],
  auditLogs: [],
  isLoading: false,
  error: null,
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  fetchPolicies: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(BASE_URL, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch policies');
      }
      
      const policies = await response.json();
      set({ policies, isLoading: false });
    } catch (error: any) {
      console.error('Fetch policies error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchPolicyById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch policy');
      }
      
      const policy = await response.json();
      
      // Update in store
      set(state => ({
        policies: state.policies.some(p => p.id === id)
          ? state.policies.map(p => p.id === id ? policy : p)
          : [...state.policies, policy],
        isLoading: false,
      }));
      
      return policy;
    } catch (error: any) {
      console.error('Fetch policy by ID error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createPolicy: async (policyData: Partial<PolicyDocument>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(policyData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create policy');
      }
      
      const policy = await response.json();
      
      set(state => ({
        policies: [...state.policies, policy],
        isLoading: false,
      }));
      
      return policy;
    } catch (error: any) {
      console.error('Create policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  publishPolicy: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}/publish`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish policy');
      }
      
      const policy = await response.json();
      
      set(state => ({
        policies: state.policies.map(p => p.id === id ? policy : p),
        isLoading: false,
      }));
      
      return policy;
    } catch (error: any) {
      console.error('Publish policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  archivePolicy: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${id}/archive`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to archive policy');
      }
      
      const policy = await response.json();
      
      set(state => ({
        policies: state.policies.map(p => p.id === id ? policy : p),
        isLoading: false,
      }));
      
      return policy;
    } catch (error: any) {
      console.error('Archive policy error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // ASSIGNMENTS - STAFF VIEW
  // ============================================================================
  
  fetchMyAssignments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/my-assignments`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || 'Failed to fetch assignments');
      }
      
      const myAssignments = await response.json();
      console.log('Fetched assignments:', myAssignments);
      set({ myAssignments, isLoading: false });
    } catch (error: any) {
      console.error('Fetch my assignments error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  acknowledgeAssignment: async (assignmentId: string, viewedAt?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/assignments/${assignmentId}/acknowledge`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          viewed_at: viewedAt,
          ip_address: window.location.hostname,
          user_agent: navigator.userAgent,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to acknowledge assignment');
      }
      
      const acknowledgement = await response.json();
      
      // Update assignment status in store
      set(state => ({
        myAssignments: state.myAssignments.map(a =>
          a.id === assignmentId ? { ...a, status: 'acknowledged' as AssignmentStatus } : a
        ),
        isLoading: false,
      }));
      
      return acknowledgement;
    } catch (error: any) {
      console.error('Acknowledge assignment error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  markAsViewed: async (assignmentId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/assignments/${assignmentId}/view`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark as viewed');
      }
      
      // Update assignment status in store
      set(state => ({
        myAssignments: state.myAssignments.map(a =>
          a.id === assignmentId && a.status === 'pending'
            ? { ...a, status: 'viewed' as AssignmentStatus }
            : a
        ),
      }));
    } catch (error: any) {
      console.error('Mark as viewed error:', error);
    }
  },
  
  // ============================================================================
  // ASSIGNMENTS - MANAGER/ADMIN VIEW
  // ============================================================================
  
  fetchAllAssignments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/assignments`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch assignments' }));
        throw new Error(error.error || 'Failed to fetch assignments');
      }
      
      const allAssignments = await response.json();
      set({ allAssignments, isLoading: false });
    } catch (error: any) {
      console.debug('Fetch all assignments error:', error);
      // Set empty array instead of throwing - this feature may not be deployed yet
      set({ allAssignments: [], isLoading: false });
    }
  },
  
  fetchPolicyAssignments: async (policyId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${policyId}/assignments`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch policy assignments');
      }
      
      const assignments = await response.json();
      set({ isLoading: false });
      return assignments;
    } catch (error: any) {
      console.error('Fetch policy assignments error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createAssignments: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/assignments`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create assignments');
      }
      
      const assignments = await response.json();
      
      set(state => ({
        allAssignments: [...state.allAssignments, ...assignments],
        isLoading: false,
      }));
      
      return assignments;
    } catch (error: any) {
      console.error('Create assignments error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // ACKNOWLEDGEMENTS
  // ============================================================================
  
  fetchAcknowledgements: async (policyId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/${policyId}/acknowledgements`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch acknowledgements');
      }
      
      const acknowledgements = await response.json();
      set({ acknowledgements, isLoading: false });
    } catch (error: any) {
      console.error('Fetch acknowledgements error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // COMPLIANCE
  // ============================================================================
  
  fetchComplianceStats: async () => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('🔍 [POLICIES] Step 1: Starting fetchComplianceStats...');
      
      console.log('🔍 [POLICIES] Step 2: Getting auth headers...');
      const headers = await getAuthHeaders().catch(err => {
        console.debug('[POLICIES] Auth headers not available:', err.message);
        // If auth fails, return empty stats instead of throwing
        throw err;
      });
      
      console.log('🔍 [POLICIES] Step 3: Auth headers retrieved, making fetch request...');
      const response = await fetch(`${BASE_URL}/compliance/stats`, {
        headers,
      });
      
      console.log('🔍 [POLICIES] Step 4: Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        console.error('❌ [POLICIES] Response not OK, attempting to parse error...');
        let errorData;
        try {
          errorData = await response.json();
          console.error('❌ [POLICIES] Error response JSON:', errorData);
        } catch (e) {
          console.error('❌ [POLICIES] Failed to parse error response:', e);
          const text = await response.text().catch(() => '(unable to read response text)');
          console.error('❌ [POLICIES] Response text:', text.substring(0, 500));
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text.substring(0, 200)}`);
        }
        throw new Error(errorData.error || `Failed to fetch compliance stats: ${response.statusText}`);
      }
      
      console.log('🔍 [POLICIES] Step 5: Parsing successful response JSON...');
      const complianceStats = await response.json();
      console.log('✅ [POLICIES] Step 6: Compliance stats fetched successfully:', complianceStats);
      set({ complianceStats, isLoading: false });
    } catch (error: any) {
      console.debug('[POLICIES] fetchComplianceStats error:', error.message);
      // Set empty stats instead of throwing - this feature may not be available yet
      const emptyStats = {
        total_policies: 0,
        total_assignments: 0,
        acknowledged: 0,
        pending: 0,
        overdue: 0,
        due_soon: 0,
        completion_rate: 0
      };
      set({ complianceStats: emptyStats, isLoading: false });
    }
  },
  
  fetchPolicyCompliance: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/compliance/by-policy`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch policy compliance' }));
        throw new Error(error.error || 'Failed to fetch policy compliance');
      }
      
      const policyCompliance = await response.json();
      set({ policyCompliance, isLoading: false });
    } catch (error: any) {
      console.debug('Fetch policy compliance error:', error);
      // Set empty array instead of throwing - this feature may not be deployed yet
      set({ policyCompliance: [], isLoading: false });
    }
  },
  
  // ============================================================================
  // AUDIT
  // ============================================================================
  
  fetchAuditLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/audit`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch audit logs' }));
        throw new Error(error.error || 'Failed to fetch audit logs');
      }
      
      const auditLogs = await response.json();
      set({ auditLogs, isLoading: false });
    } catch (error: any) {
      console.debug('Fetch audit logs error:', error);
      // Set empty array instead of throwing - this feature may not be deployed yet
      set({ auditLogs: [], isLoading: false });
    }
  },
  
  // ============================================================================
  // EXPORT
  // ============================================================================
  
  exportAcknowledgements: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/export/acknowledgements`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export acknowledgements');
      }
      
      const data = await response.json();
      set({ isLoading: false });
      return data;
    } catch (error: any) {
      console.error('Export acknowledgements error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  exportAssignments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/export/assignments`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export assignments');
      }
      
      const data = await response.json();
      set({ isLoading: false });
      return data;
    } catch (error: any) {
      console.error('Export assignments error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // STORAGE
  // ============================================================================
  
  getDownloadUrl: async (policyId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${policyId}/download-url`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download URL');
      }
      
      const { url } = await response.json();
      return url;
    } catch (error: any) {
      console.error('Get download URL error:', error);
      throw error;
    }
  },
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    policies: [],
    myAssignments: [],
    allAssignments: [],
    acknowledgements: [],
    complianceStats: null,
    policyCompliance: [],
    auditLogs: [],
    isLoading: false,
    error: null,
  }),
}));