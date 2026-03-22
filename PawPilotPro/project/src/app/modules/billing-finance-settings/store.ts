// Billing & Finance Settings Store - MDC Operations Centre

import { create } from 'zustand';
import type {
  PaymentProvider,
  InvoiceSettings,
  TaxRule,
  FeeDefinition,
  RefundSettings,
  RefundRecord,
  CreditRecord,
  MembershipBillingRules,
  FinancialPermission,
  ApprovalRule,
  ExportConfiguration,
  ExportRecord,
  FinancialAuditLog,
  AuditControls,
  BillingFinanceStats,
} from './types';
import * as api from './api';

interface BillingFinanceSettingsState {
  // Data
  paymentProviders: PaymentProvider[];
  invoiceSettings: InvoiceSettings[];
  taxRules: TaxRule[];
  fees: FeeDefinition[];
  refundSettings: RefundSettings | null;
  refunds: RefundRecord[];
  credits: CreditRecord[];
  membershipBillingRules: MembershipBillingRules | null;
  permissions: FinancialPermission[];
  approvalRules: ApprovalRule[];
  exportConfigs: ExportConfiguration[];
  exports: ExportRecord[];
  auditControls: AuditControls | null;
  auditLogs: FinancialAuditLog[];
  stats: BillingFinanceStats | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  loadAll: () => Promise<void>;
  loadPaymentProviders: () => Promise<void>;
  updatePaymentProvider: (id: string, data: Partial<PaymentProvider>) => Promise<void>;
  
  loadInvoiceSettings: () => Promise<void>;
  updateInvoiceSettings: (id: string, data: Partial<InvoiceSettings>) => Promise<void>;
  
  loadTaxRules: () => Promise<void>;
  createTaxRule: (data: Partial<TaxRule>) => Promise<void>;
  updateTaxRule: (id: string, data: Partial<TaxRule>) => Promise<void>;
  deleteTaxRule: (id: string) => Promise<void>;
  
  loadFees: () => Promise<void>;
  createFee: (data: Partial<FeeDefinition>) => Promise<void>;
  updateFee: (id: string, data: Partial<FeeDefinition>) => Promise<void>;
  deleteFee: (id: string) => Promise<void>;
  
  loadRefundSettings: () => Promise<void>;
  updateRefundSettings: (data: Partial<RefundSettings>) => Promise<void>;
  
  loadRefunds: () => Promise<void>;
  createRefund: (data: Partial<RefundRecord>) => Promise<void>;
  
  loadCredits: () => Promise<void>;
  createCredit: (data: Partial<CreditRecord>) => Promise<void>;
  
  loadMembershipBillingRules: () => Promise<void>;
  updateMembershipBillingRules: (data: Partial<MembershipBillingRules>) => Promise<void>;
  
  loadPermissions: () => Promise<void>;
  updatePermission: (id: string, data: Partial<FinancialPermission>) => Promise<void>;
  
  loadApprovalRules: () => Promise<void>;
  createApprovalRule: (data: Partial<ApprovalRule>) => Promise<void>;
  updateApprovalRule: (id: string, data: Partial<ApprovalRule>) => Promise<void>;
  deleteApprovalRule: (id: string) => Promise<void>;
  
  loadExportConfigs: () => Promise<void>;
  createExportConfig: (data: Partial<ExportConfiguration>) => Promise<void>;
  updateExportConfig: (id: string, data: Partial<ExportConfiguration>) => Promise<void>;
  deleteExportConfig: (id: string) => Promise<void>;
  
  loadExports: () => Promise<void>;
  createExport: (data: Partial<ExportRecord>) => Promise<void>;
  
  loadAuditControls: () => Promise<void>;
  updateAuditControls: (data: Partial<AuditControls>) => Promise<void>;
  
  loadAuditLogs: () => Promise<void>;
  
  loadStats: () => Promise<void>;
  
  seedData: () => Promise<void>;
}

export const useBillingFinanceSettingsStore = create<BillingFinanceSettingsState>((set, get) => ({
  // Initial state
  paymentProviders: [],
  invoiceSettings: [],
  taxRules: [],
  fees: [],
  refundSettings: null,
  refunds: [],
  credits: [],
  membershipBillingRules: null,
  permissions: [],
  approvalRules: [],
  exportConfigs: [],
  exports: [],
  auditControls: null,
  auditLogs: [],
  stats: null,
  isLoading: false,
  error: null,

  // Load all data
  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().loadPaymentProviders(),
        get().loadInvoiceSettings(),
        get().loadTaxRules(),
        get().loadFees(),
        get().loadRefundSettings(),
        get().loadMembershipBillingRules(),
        get().loadPermissions(),
        get().loadApprovalRules(),
        get().loadExportConfigs(),
        get().loadAuditControls(),
        get().loadStats(),
      ]);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  // Payment Providers
  loadPaymentProviders: async () => {
    try {
      const paymentProviders = await api.getPaymentProviders();
      set({ paymentProviders });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updatePaymentProvider: async (id, data) => {
    try {
      const updated = await api.updatePaymentProvider(id, data);
      set((state) => ({
        paymentProviders: state.paymentProviders.map((p) =>
          p.id === id ? updated : p
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Invoice Settings
  loadInvoiceSettings: async () => {
    try {
      const invoiceSettings = await api.getInvoiceSettings();
      set({ invoiceSettings });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateInvoiceSettings: async (id, data) => {
    try {
      const updated = await api.updateInvoiceSettings(id, data);
      set((state) => ({
        invoiceSettings: state.invoiceSettings.map((s) =>
          s.id === id ? updated : s
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Tax Rules
  loadTaxRules: async () => {
    try {
      const taxRules = await api.getTaxRules();
      set({ taxRules });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createTaxRule: async (data) => {
    try {
      const created = await api.createTaxRule(data);
      set((state) => ({ taxRules: [...state.taxRules, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateTaxRule: async (id, data) => {
    try {
      const updated = await api.updateTaxRule(id, data);
      set((state) => ({
        taxRules: state.taxRules.map((r) => (r.id === id ? updated : r)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteTaxRule: async (id) => {
    try {
      await api.deleteTaxRule(id);
      set((state) => ({
        taxRules: state.taxRules.filter((r) => r.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Fees
  loadFees: async () => {
    try {
      const fees = await api.getFees();
      set({ fees });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createFee: async (data) => {
    try {
      const created = await api.createFee(data);
      set((state) => ({ fees: [...state.fees, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateFee: async (id, data) => {
    try {
      const updated = await api.updateFee(id, data);
      set((state) => ({
        fees: state.fees.map((f) => (f.id === id ? updated : f)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteFee: async (id) => {
    try {
      await api.deleteFee(id);
      set((state) => ({
        fees: state.fees.filter((f) => f.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Refund Settings
  loadRefundSettings: async () => {
    try {
      const refundSettings = await api.getRefundSettings();
      set({ refundSettings });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateRefundSettings: async (data) => {
    try {
      const updated = await api.updateRefundSettings(data);
      set({ refundSettings: updated });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Refunds
  loadRefunds: async () => {
    try {
      const refunds = await api.getRefunds();
      set({ refunds });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createRefund: async (data) => {
    try {
      const created = await api.createRefund(data);
      set((state) => ({ refunds: [...state.refunds, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Credits
  loadCredits: async () => {
    try {
      const credits = await api.getCredits();
      set({ credits });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createCredit: async (data) => {
    try {
      const created = await api.createCredit(data);
      set((state) => ({ credits: [...state.credits, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Membership Billing Rules
  loadMembershipBillingRules: async () => {
    try {
      const membershipBillingRules = await api.getMembershipBillingRules();
      set({ membershipBillingRules });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateMembershipBillingRules: async (data) => {
    try {
      const updated = await api.updateMembershipBillingRules(data);
      set({ membershipBillingRules: updated });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Permissions
  loadPermissions: async () => {
    try {
      const permissions = await api.getPermissions();
      set({ permissions });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updatePermission: async (id, data) => {
    try {
      const updated = await api.updatePermission(id, data);
      set((state) => ({
        permissions: state.permissions.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Approval Rules
  loadApprovalRules: async () => {
    try {
      const approvalRules = await api.getApprovalRules();
      set({ approvalRules });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createApprovalRule: async (data) => {
    try {
      const created = await api.createApprovalRule(data);
      set((state) => ({ approvalRules: [...state.approvalRules, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateApprovalRule: async (id, data) => {
    try {
      const updated = await api.updateApprovalRule(id, data);
      set((state) => ({
        approvalRules: state.approvalRules.map((r) =>
          r.id === id ? updated : r
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteApprovalRule: async (id) => {
    try {
      await api.deleteApprovalRule(id);
      set((state) => ({
        approvalRules: state.approvalRules.filter((r) => r.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Export Configs
  loadExportConfigs: async () => {
    try {
      const exportConfigs = await api.getExportConfigs();
      set({ exportConfigs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createExportConfig: async (data) => {
    try {
      const created = await api.createExportConfig(data);
      set((state) => ({ exportConfigs: [...state.exportConfigs, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateExportConfig: async (id, data) => {
    try {
      const updated = await api.updateExportConfig(id, data);
      set((state) => ({
        exportConfigs: state.exportConfigs.map((c) =>
          c.id === id ? updated : c
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteExportConfig: async (id) => {
    try {
      await api.deleteExportConfig(id);
      set((state) => ({
        exportConfigs: state.exportConfigs.filter((c) => c.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Exports
  loadExports: async () => {
    try {
      const exports = await api.getExports();
      set({ exports });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createExport: async (data) => {
    try {
      const created = await api.createExport(data);
      set((state) => ({ exports: [...state.exports, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Audit Controls
  loadAuditControls: async () => {
    try {
      const auditControls = await api.getAuditControls();
      set({ auditControls });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateAuditControls: async (data) => {
    try {
      const updated = await api.updateAuditControls(data);
      set({ auditControls: updated });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Audit Logs
  loadAuditLogs: async () => {
    try {
      const auditLogs = await api.getAuditLogs();
      set({ auditLogs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Statistics
  loadStats: async () => {
    try {
      const stats = await api.getStats();
      set({ stats });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Seed Data
  seedData: async () => {
    try {
      await api.seedData();
      await get().loadAll();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
