import { create } from 'zustand';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { supabase } from '../../../../utils/supabase/client';
import {
  Approval,
  ImpactPreview,
  LocationPriceOverrideProposal,
  PriceBookVersion,
  SubmitPriceBookRequest,
  ApprovePriceBookRequest,
  RejectPriceBookRequest,
  ProposeLocationOverrideRequest,
  ApproveLocationOverrideRequest,
  RejectLocationOverrideRequest,
} from '../types/approvals';

// Validate that required config is available
if (!projectId || !publicAnonKey) {
  console.error('Missing Supabase configuration:', { projectId: !!projectId, publicAnonKey: !!publicAnonKey });
}

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pricing-approvals`;

// Auth helper - get headers with user token
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-User-Token': `Bearer ${session?.access_token || ''}`,
  };
}

export interface ApprovalsState {
  // Data
  pendingApprovals: Approval[];
  approvalHistory: Approval[];
  impactPreview: ImpactPreview | null;
  
  // Loading states
  isLoading: boolean;
  isSubmitting: boolean;
  
  // ========================================================================
  // PRICE BOOK WORKFLOWS
  // ========================================================================
  
  // Direct activation (Admin/Manager)
  activatePriceBook: (priceBookVersionId: string, activateImmediately: boolean, scheduledActivationDate?: string, comment?: string) => Promise<void>;
  
  // Approval workflow (Assistant Manager)
  submitPriceBook: (request: SubmitPriceBookRequest) => Promise<void>;
  approvePriceBook: (request: ApprovePriceBookRequest) => Promise<void>;
  rejectPriceBook: (request: RejectPriceBookRequest) => Promise<void>;
  
  // ========================================================================
  // LOCATION OVERRIDE WORKFLOWS
  // ========================================================================
  
  // Direct activation (Admin/Manager)
  activateLocationOverride: (locationId: string, serviceId: string, price: number, effectiveFrom: string, effectiveTo: string | undefined, justification: string) => Promise<void>;
  
  // Approval workflow (Assistant Manager)
  proposeLocationOverride: (request: ProposeLocationOverrideRequest) => Promise<LocationPriceOverrideProposal>;
  approveLocationOverride: (request: ApproveLocationOverrideRequest) => Promise<void>;
  rejectLocationOverride: (request: RejectLocationOverrideRequest) => Promise<void>;
  
  // ========================================================================
  // IMPACT PREVIEW
  // ========================================================================
  
  generateImpactPreview: (type: string, referenceId: string, proposedChanges?: any) => Promise<void>;
  
  // ========================================================================
  // APPROVALS QUERY
  // ========================================================================
  
  fetchPendingApprovals: () => Promise<void>;
  fetchApprovalHistory: () => Promise<void>;
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  pendingApprovals: [],
  approvalHistory: [],
  impactPreview: null,
  isLoading: false,
  isSubmitting: false,
  
  // ========================================================================
  // PRICE BOOK WORKFLOWS
  // ========================================================================
  
  // Direct activation (Admin/Manager)
  activatePriceBook: async (priceBookVersionId, activateImmediately, scheduledActivationDate, comment) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/price-book/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ priceBookVersionId, activateImmediately, scheduledActivationDate, comment })
      });
      
      if (!res.ok) {
        let errorMessage = 'Failed to activate price book';
        try {
          const error = await res.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Refresh approvals
      await get().fetchPendingApprovals();
      await get().fetchApprovalHistory();
      set({ isSubmitting: false });
    } catch (e: any) {
      console.error('Activate price book error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  // Approval workflow (Assistant Manager)
  submitPriceBook: async (request) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/price-book/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(request)
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit price book');
      }
      
      // Refresh pending approvals
      await get().fetchPendingApprovals();
      set({ isSubmitting: false });
    } catch (e: any) {
      console.error('Submit price book error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  approvePriceBook: async (request) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/price-book/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(request)
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve price book');
      }
      
      // Refresh approvals
      await get().fetchPendingApprovals();
      await get().fetchApprovalHistory();
      set({ isSubmitting: false });
    } catch (e: any) {
      console.error('Approve price book error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  rejectPriceBook: async (request) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/price-book/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(request)
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject price book');
      }
      
      // Refresh approvals
      await get().fetchPendingApprovals();
      await get().fetchApprovalHistory();
      set({ isSubmitting: false });
    } catch (e: any) {
      console.error('Reject price book error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  // ========================================================================
  // LOCATION OVERRIDE WORKFLOWS
  // ========================================================================
  
  // Direct activation (Admin/Manager)
  activateLocationOverride: async (locationId, serviceId, price, effectiveFrom, effectiveTo, justification) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/location-override/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ locationId, serviceId, price, effectiveFrom, effectiveTo, justification })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to activate location override');
      }
      
      // Refresh approvals
      await get().fetchPendingApprovals();
      await get().fetchApprovalHistory();
      set({ isSubmitting: false });
    } catch (e: any) {
      console.error('Activate location override error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  // Approval workflow (Assistant Manager)
  proposeLocationOverride: async (request) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/location-override/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(request)
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to propose location override');
      }
      
      const { proposal } = await res.json();
      
      // Refresh pending approvals
      await get().fetchPendingApprovals();
      set({ isSubmitting: false });
      
      return proposal;
    } catch (e: any) {
      console.error('Propose location override error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  approveLocationOverride: async (request) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/location-override/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(request)
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve location override');
      }
      
      // Refresh approvals
      await get().fetchPendingApprovals();
      await get().fetchApprovalHistory();
      set({ isSubmitting: false });
    } catch (e: any) {
      console.error('Approve location override error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  rejectLocationOverride: async (request) => {
    try {
      set({ isSubmitting: true });
      const res = await fetch(`${API_URL}/location-override/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(request)
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject location override');
      }
      
      // Refresh approvals
      await get().fetchPendingApprovals();
      await get().fetchApprovalHistory();
      set({ isSubmitting: false });
    } catch (e: any) {
      console.error('Reject location override error:', e);
      set({ isSubmitting: false });
      throw e;
    }
  },
  
  // ========================================================================
  // IMPACT PREVIEW
  // ========================================================================
  
  generateImpactPreview: async (type, referenceId, proposedChanges = {}) => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/impact-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ type, referenceId, proposedChanges })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate impact preview');
      }
      
      const impactPreview = await res.json();
      set({ impactPreview, isLoading: false });
    } catch (e: any) {
      console.error('Generate impact preview error:', e);
      set({ isLoading: false });
      throw e;
    }
  },
  
  // ========================================================================
  // APPROVALS QUERY
  // ========================================================================
  
  fetchPendingApprovals: async () => {
    // Don't attempt API call if configuration is missing
    if (!projectId || !publicAnonKey) {
      set({ pendingApprovals: [], isLoading: false });
      return;
    }
    
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/approvals/pending`, {
        headers: await getAuthHeaders()
      }).catch(err => {
        // Network error - silently fail
        throw new Error(`Network error: ${err.message}`);
      });
      
      if (res.ok) {
        const pendingApprovals = await res.json();
        set({ pendingApprovals: Array.isArray(pendingApprovals) ? pendingApprovals : [], isLoading: false });
      } else {
        // Non-OK response - silently use empty array
        set({ pendingApprovals: [], isLoading: false });
      }
    } catch (e: any) {
      // Silently handle errors
      set({ pendingApprovals: [], isLoading: false });
    }
  },
  
  fetchApprovalHistory: async () => {
    // Don't attempt API call if configuration is missing
    if (!projectId || !publicAnonKey) {
      set({ approvalHistory: [], isLoading: false });
      return;
    }
    
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/approvals/history`, {
        headers: await getAuthHeaders()
      }).catch(err => {
        // Network error - silently fail
        throw new Error(`Network error: ${err.message}`);
      });
      
      if (res.ok) {
        const approvalHistory = await res.json();
        set({ approvalHistory: Array.isArray(approvalHistory) ? approvalHistory : [], isLoading: false });
      } else {
        // Non-OK response - silently use empty array
        set({ approvalHistory: [], isLoading: false });
      }
    } catch (e: any) {
      // Silently handle errors
      set({ approvalHistory: [], isLoading: false });
    }
  },
}));