// Billing Store - MDC Operations Centre
// Zustand store for all billing operations

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/billing`;

// Development mode - use mock data if backend is not available
const USE_MOCK_DATA = false; // Set to true for development without backend

// ============================================================================
// TYPES
// ============================================================================

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'void' | 'part_paid';
export type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'direct_debit' | 'provider';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'past_due';

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  service_id: string;
  service_name: string;
  module: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  booking_reference?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  household_id: string;
  household_name: string;
  location_id: string;
  location_name: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  balance: number;
  tags: string[];
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
}

export interface Payment {
  id: string;
  household_id: string;
  household_name: string;
  location_id: string;
  amount: number;
  method: PaymentMethod;
  provider_reference?: string;
  status: 'pending' | 'completed' | 'failed';
  allocation_status: 'unallocated' | 'allocated' | 'partial';
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount: number;
  created_by: string;
  created_at: string;
}

export interface Credit {
  id: string;
  household_id: string;
  household_name: string;
  amount: number;
  reason: string;
  source: 'overpayment' | 'goodwill' | 'credit_note' | 'refund_reversal';
  expires_at?: string;
  used_amount: number;
  balance: number;
  created_by: string;
  created_at: string;
}

export interface Refund {
  id: string;
  payment_id?: string;
  invoice_id?: string;
  household_id: string;
  household_name: string;
  amount: number;
  method: PaymentMethod;
  provider_reference?: string;
  reason: string;
  approved_by: string;
  created_by: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  household_id: string;
  household_name: string;
  plan_id: string;
  plan_name: string;
  plan_version: number;
  pet_ids: string[];
  status: SubscriptionStatus;
  monthly_price: number;
  credits_included?: number;
  credits_used?: number;
  billing_method: PaymentMethod;
  renewal_date: string;
  started_at: string;
  paused_at?: string;
  cancelled_at?: string;
  created_by: string;
  created_at: string;
}

export interface Fee {
  id: string;
  household_id: string;
  household_name: string;
  location_id: string;
  fee_type: string;
  amount: number;
  reason: string;
  booking_reference?: string;
  invoiced: boolean;
  invoice_id?: string;
  created_by: string;
  created_at: string;
}

export interface BillingExport {
  id: string;
  export_type: string;
  scope: string;
  format: 'csv' | 'pdf';
  filters: Record<string, unknown>;
  file_url?: string;
  created_by: string;
  created_at: string;
}

export interface BillingOverview {
  outstanding: {
    total: number;
    current: number;
    early: number;
    mid: number;
    late: number;
  };
  invoices_due_this_week: number;
  invoices_due_total: number;
  payments: {
    today: number;
    week: number;
    month: number;
  };
  failed_payments: number;
  membership_revenue: number;
  active_memberships: number;
  refunds_month: number;
  credits_month: number;
}

// ============================================================================
// API PAYLOADS & RESPONSE ENVELOPES
// ============================================================================

/** Query-string filters accepted by the billing list endpoints. */
export type BillingListFilters = Record<string, string>;

/** Line item supplied when creating an invoice; totals are calculated server-side. */
export interface CreateInvoiceLineItemPayload {
  service_id: string;
  service_name: string;
  module: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  discount?: number;
  booking_reference?: string;
}

export interface CreateInvoicePayload {
  household_id: string;
  household_name: string;
  location_id: string;
  location_name: string;
  line_items: CreateInvoiceLineItemPayload[];
  created_by: string;
}

export interface RecordPaymentPayload {
  household_id: string;
  household_name: string;
  location_id: string;
  amount: number;
  method: PaymentMethod;
  provider_reference?: string;
  notes?: string;
  created_by: string;
}

export interface CreateSubscriptionPayload {
  household_id: string;
  household_name: string;
  plan_id: string;
  plan_name: string;
  plan_version?: number;
  pet_ids: string[];
  monthly_price: number;
  billing_method: PaymentMethod;
  created_by: string;
}

export interface CreateCreditPayload {
  household_id: string;
  household_name: string;
  amount: number;
  reason: string;
  source: Credit['source'];
  expires_days?: number;
  created_by: string;
}

export interface IssueRefundPayload {
  payment_id?: string;
  invoice_id?: string;
  household_id: string;
  household_name: string;
  amount: number;
  method: PaymentMethod;
  provider_reference?: string;
  reason: string;
  approved_by: string;
  created_by: string;
}

export interface CreateFeePayload {
  household_id: string;
  household_name: string;
  location_id: string;
  fee_type: string;
  amount: number;
  reason: string;
  booking_reference?: string;
  created_by: string;
}

export interface CreateExportPayload {
  export_type: string;
  scope: string;
  format: BillingExport['format'];
  filters?: Record<string, unknown>;
  created_by: string;
}

/** Error envelope returned by the billing API on failure. */
interface ApiErrorBody {
  error?: string;
}

// ============================================================================
// STORE
// ============================================================================

interface BillingState {
  // Overview
  overview: BillingOverview | null;
  
  // Invoices
  invoices: Invoice[];
  selectedInvoice: Invoice | null;
  invoiceLineItems: InvoiceLineItem[];
  
  // Payments
  payments: Payment[];
  selectedPayment: Payment | null;
  paymentAllocations: PaymentAllocation[];
  
  // Subscriptions
  subscriptions: Subscription[];
  selectedSubscription: Subscription | null;
  
  // Credits & Refunds
  credits: Credit[];
  refunds: Refund[];
  
  // Fees
  fees: Fee[];
  
  // Exports
  exports: BillingExport[];
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchOverview: (locationId?: string) => Promise<void>;
  fetchInvoices: (filters?: BillingListFilters) => Promise<void>;
  fetchInvoice: (id: string) => Promise<void>;
  createInvoice: (data: CreateInvoicePayload) => Promise<Invoice>;
  issueInvoice: (id: string, dueDays?: number, issuedBy?: string) => Promise<void>;
  voidInvoice: (id: string, reason: string, voidedBy: string) => Promise<void>;

  fetchPayments: (filters?: BillingListFilters) => Promise<void>;
  fetchPayment: (id: string) => Promise<void>;
  recordPayment: (data: RecordPaymentPayload) => Promise<Payment>;
  allocatePayment: (paymentId: string, invoiceId: string, amount: number, createdBy: string) => Promise<void>;

  fetchSubscriptions: (filters?: BillingListFilters) => Promise<void>;
  createSubscription: (data: CreateSubscriptionPayload) => Promise<Subscription>;
  pauseSubscription: (id: string, reason: string) => Promise<void>;
  cancelSubscription: (id: string, reason: string) => Promise<void>;

  fetchCredits: (householdId?: string) => Promise<void>;
  createCredit: (data: CreateCreditPayload) => Promise<Credit>;
  fetchRefunds: (householdId?: string) => Promise<void>;
  issueRefund: (data: IssueRefundPayload) => Promise<Refund>;

  fetchFees: (filters?: BillingListFilters) => Promise<void>;
  createFee: (data: CreateFeePayload) => Promise<Fee>;

  fetchExports: () => Promise<void>;
  createExport: (data: CreateExportPayload) => Promise<BillingExport>;
  
  seedData: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  // Initial State
  overview: null,
  invoices: [],
  selectedInvoice: null,
  invoiceLineItems: [],
  payments: [],
  selectedPayment: null,
  paymentAllocations: [],
  subscriptions: [],
  selectedSubscription: null,
  credits: [],
  refunds: [],
  fees: [],
  exports: [],
  loading: false,
  error: null,

  // ========== OVERVIEW ==========
  fetchOverview: async (locationId) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const url = locationId 
        ? `${BASE_URL}/overview?location_id=${locationId}`
        : `${BASE_URL}/overview`;
      
      console.log('Fetching billing overview from:', url);
        
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Billing overview error response:', errorText);
        throw new Error(`Failed to fetch billing overview: ${response.status} ${response.statusText}`);
      }
      
      const overview = (await response.json()) as BillingOverview;
      set({ overview, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching billing overview:', error);
      console.error('Full error details:', { error, BASE_URL });
    }
  },

  // ========== INVOICES ==========
  fetchInvoices: async (filters = {}) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const params = new URLSearchParams(filters).toString();
      const url = params ? `${BASE_URL}/invoices?${params}` : `${BASE_URL}/invoices`;
      
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const { invoices } = (await response.json()) as { invoices: Invoice[] };
      set({ invoices, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching invoices:', error);
    }
  },

  fetchInvoice: async (id) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/invoices/${id}`, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoice');
      }
      
      const { invoice, line_items, allocations } = (await response.json()) as {
        invoice: Invoice;
        line_items: InvoiceLineItem[];
        allocations: PaymentAllocation[];
      };
      set({ 
        selectedInvoice: invoice, 
        invoiceLineItems: line_items,
        paymentAllocations: allocations,
        loading: false 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching invoice:', error);
    }
  },

  createInvoice: async (data) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/invoices`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }
      
      const { invoice } = (await response.json()) as { invoice: Invoice };
      set(state => ({
        invoices: [invoice, ...state.invoices],
        loading: false
      }));

      broadcastMutation('billing', 'invoice', 'created');

      return invoice;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error creating invoice:', error);
      throw error;
    }
  },

  issueInvoice: async (id, dueDays = 7, issuedBy = 'admin') => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/invoices/${id}/issue`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ due_days: dueDays, issued_by: issuedBy }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to issue invoice');
      }
      
      const { invoice } = (await response.json()) as { invoice: Invoice };
      set(state => ({
        invoices: state.invoices.map(inv => inv.id === id ? invoice : inv),
        selectedInvoice: state.selectedInvoice?.id === id ? invoice : state.selectedInvoice,
        loading: false,
      }));
      broadcastMutation('billing', 'invoice', 'updated', id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error issuing invoice:', error);
      throw error;
    }
  },

  voidInvoice: async (id, reason, voidedBy) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/invoices/${id}/void`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ reason, voided_by: voidedBy }),
      });
      
      if (!response.ok) {
        const error = (await response.json()) as ApiErrorBody;
        throw new Error(error.error || 'Failed to void invoice');
      }
      
      const { invoice } = (await response.json()) as { invoice: Invoice };
      set(state => ({
        invoices: state.invoices.map(inv => inv.id === id ? invoice : inv),
        selectedInvoice: state.selectedInvoice?.id === id ? invoice : state.selectedInvoice,
        loading: false,
      }));
      broadcastMutation('billing', 'invoice', 'updated', id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error voiding invoice:', error);
      throw error;
    }
  },

  // ========== PAYMENTS ==========
  fetchPayments: async (filters = {}) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const params = new URLSearchParams(filters).toString();
      const url = params ? `${BASE_URL}/payments?${params}` : `${BASE_URL}/payments`;
      
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }
      
      const { payments } = (await response.json()) as { payments: Payment[] };
      set({ payments, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching payments:', error);
    }
  },

  fetchPayment: async (id) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/payments/${id}`, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment');
      }
      
      const { payment, allocations } = (await response.json()) as {
        payment: Payment;
        allocations: PaymentAllocation[];
      };
      set({ 
        selectedPayment: payment,
        paymentAllocations: allocations,
        loading: false 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching payment:', error);
    }
  },

  recordPayment: async (data) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to record payment');
      }
      
      const { payment } = (await response.json()) as { payment: Payment };
      set(state => ({ 
        payments: [payment, ...state.payments],
        loading: false
      }));

      broadcastMutation('billing', 'payment', 'created');

      return payment;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error recording payment:', error);
      throw error;
    }
  },

  allocatePayment: async (paymentId, invoiceId, amount, createdBy) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/payments/${paymentId}/allocate`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId, amount, created_by: createdBy }),
      });
      
      if (!response.ok) {
        const error = (await response.json()) as ApiErrorBody;
        throw new Error(error.error || 'Failed to allocate payment');
      }

      const { allocation, invoice, payment } = (await response.json()) as {
        allocation: PaymentAllocation;
        invoice: Invoice;
        payment: Payment;
      };
      
      set(state => ({
        payments: state.payments.map(p => p.id === paymentId ? payment : p),
        invoices: state.invoices.map(inv => inv.id === invoiceId ? invoice : inv),
        paymentAllocations: [...state.paymentAllocations, allocation],
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error allocating payment:', error);
      throw error;
    }
  },

  // ========== SUBSCRIPTIONS ==========
  fetchSubscriptions: async (filters = {}) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const params = new URLSearchParams(filters).toString();
      const url = params ? `${BASE_URL}/subscriptions?${params}` : `${BASE_URL}/subscriptions`;
      
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }
      
      const { subscriptions } = (await response.json()) as { subscriptions: Subscription[] };
      set({ subscriptions, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching subscriptions:', error);
    }
  },

  createSubscription: async (data) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }
      
      const { subscription } = (await response.json()) as { subscription: Subscription };
      set(state => ({ 
        subscriptions: [subscription, ...state.subscriptions],
        loading: false
      }));

      broadcastMutation('billing', 'subscription', 'created');

      return subscription;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error creating subscription:', error);
      throw error;
    }
  },

  pauseSubscription: async (id, reason) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/subscriptions/${id}/pause`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to pause subscription');
      }
      
      const { subscription } = (await response.json()) as { subscription: Subscription };
      set(state => ({
        subscriptions: state.subscriptions.map(sub => sub.id === id ? subscription : sub),
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error pausing subscription:', error);
      throw error;
    }
  },

  cancelSubscription: async (id, reason) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/subscriptions/${id}/cancel`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
      
      const { subscription } = (await response.json()) as { subscription: Subscription };
      set(state => ({
        subscriptions: state.subscriptions.map(sub => sub.id === id ? subscription : sub),
        loading: false,
      }));
      broadcastMutation('billing', 'subscription', 'updated', id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  },

  // ========== CREDITS & REFUNDS ==========
  fetchCredits: async (householdId) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const url = householdId 
        ? `${BASE_URL}/credits?household_id=${householdId}`
        : `${BASE_URL}/credits`;
        
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch credits');
      }
      
      const { credits } = (await response.json()) as { credits: Credit[] };
      set({ credits, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching credits:', error);
    }
  },

  createCredit: async (data) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/credits`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create credit');
      }
      
      const { credit } = (await response.json()) as { credit: Credit };
      set(state => ({ 
        credits: [credit, ...state.credits],
        loading: false
      }));

      broadcastMutation('billing', 'credit', 'created');

      return credit;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error creating credit:', error);
      throw error;
    }
  },

  fetchRefunds: async (householdId) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const url = householdId 
        ? `${BASE_URL}/refunds?household_id=${householdId}`
        : `${BASE_URL}/refunds`;
        
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch refunds');
      }
      
      const { refunds } = (await response.json()) as { refunds: Refund[] };
      set({ refunds, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching refunds:', error);
    }
  },

  issueRefund: async (data) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/refunds`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to issue refund');
      }
      
      const { refund } = (await response.json()) as { refund: Refund };
      set(state => ({ 
        refunds: [refund, ...state.refunds],
        loading: false
      }));

      broadcastMutation('billing', 'refund', 'created');

      return refund;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error issuing refund:', error);
      throw error;
    }
  },

  // ========== FEES ==========
  fetchFees: async (filters = {}) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const params = new URLSearchParams(filters).toString();
      const url = params ? `${BASE_URL}/fees?${params}` : `${BASE_URL}/fees`;
      
      const response = await fetch(url, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch fees');
      }
      
      const { fees } = (await response.json()) as { fees: Fee[] };
      set({ fees, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching fees:', error);
    }
  },

  createFee: async (data) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/fees`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create fee');
      }
      
      const { fee } = (await response.json()) as { fee: Fee };
      set(state => ({ 
        fees: [fee, ...state.fees],
        loading: false
      }));

      broadcastMutation('billing', 'fee', 'created');

      return fee;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error creating fee:', error);
      throw error;
    }
  },

  // ========== EXPORTS ==========
  fetchExports: async () => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/exports`, { headers: await getAuthHeaders() });
      
      if (!response.ok) {
        throw new Error('Failed to fetch exports');
      }
      
      const { exports } = (await response.json()) as { exports: BillingExport[] };
      set({ exports, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error fetching exports:', error);
    }
  },

  createExport: async (data) => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/exports`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create export');
      }
      
      const { export: billingExport } = (await response.json()) as { export: BillingExport };
      set(state => ({ 
        exports: [billingExport, ...state.exports],
        loading: false
      }));

      broadcastMutation('billing', 'export', 'created');

      return billingExport;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error creating export:', error);
      throw error;
    }
  },

  // ========== SEED DATA ==========
  seedData: async () => {
    try {
      const headers = await getAuthHeaders();
      set({ loading: true, error: null });
      
      const response = await fetch(`${BASE_URL}/seed`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to seed billing data');
      }
      
      // Seed responses are diagnostic only; the shape is not relied upon.
      const result = (await response.json()) as unknown;
      console.log('Billing data seeded:', result);
      
      // Refresh all data
      await Promise.all([
        get().fetchInvoices(),
        get().fetchPayments(),
        get().fetchSubscriptions(),
      ]);
      
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, loading: false });
      console.error('Error seeding billing data:', error);
      throw error;
    }
  },
}));