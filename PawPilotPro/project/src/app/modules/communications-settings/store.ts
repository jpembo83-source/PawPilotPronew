// Communications Settings Store - MDC Operations Centre

import { create } from 'zustand';
import type {
  ChannelConfig,
  SenderIdentity,
  ConsentPolicy,
  CommunicationTemplate,
  AutomationRule,
  SLADefinition,
  CommunicationPermission,
  CommunicationDeliveryLog,
  CommunicationAuditLog,
  CommunicationStats,
  TemplateFilters,
  AutomationFilters,
  DeliveryLogFilters,
  AuditLogFilters,
} from './types';
import * as api from './api';

interface CommunicationsSettingsState {
  // Data
  channels: ChannelConfig[];
  senderIdentities: SenderIdentity[];
  consentPolicy: ConsentPolicy | null;
  templates: CommunicationTemplate[];
  automationRules: AutomationRule[];
  slaDefinitions: SLADefinition[];
  permissions: CommunicationPermission[];
  deliveryLogs: CommunicationDeliveryLog[];
  auditLogs: CommunicationAuditLog[];
  stats: CommunicationStats | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  selectedSection: string;
  
  // Filters
  templateFilters: TemplateFilters;
  automationFilters: AutomationFilters;
  deliveryLogFilters: DeliveryLogFilters;
  auditLogFilters: AuditLogFilters;
  
  // Actions
  initialize: () => Promise<void>;
  
  // Channels
  fetchChannels: () => Promise<void>;
  updateChannel: (id: string, data: Partial<ChannelConfig>) => Promise<void>;
  
  // Sender Identities
  fetchSenderIdentities: () => Promise<void>;
  createSenderIdentity: (data: Partial<SenderIdentity>) => Promise<void>;
  updateSenderIdentity: (id: string, data: Partial<SenderIdentity>) => Promise<void>;
  deleteSenderIdentity: (id: string) => Promise<void>;
  
  // Consent Policy
  fetchConsentPolicy: () => Promise<void>;
  updateConsentPolicy: (data: Partial<ConsentPolicy>) => Promise<void>;
  
  // Templates
  fetchTemplates: () => Promise<void>;
  createTemplate: (data: Partial<CommunicationTemplate>) => Promise<void>;
  updateTemplate: (id: string, data: Partial<CommunicationTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  setTemplateFilters: (filters: Partial<TemplateFilters>) => void;
  
  // Automation Rules
  fetchAutomationRules: () => Promise<void>;
  createAutomationRule: (data: Partial<AutomationRule>) => Promise<void>;
  updateAutomationRule: (id: string, data: Partial<AutomationRule>) => Promise<void>;
  deleteAutomationRule: (id: string) => Promise<void>;
  setAutomationFilters: (filters: Partial<AutomationFilters>) => void;
  
  // SLA Definitions
  fetchSLADefinitions: () => Promise<void>;
  createSLADefinition: (data: Partial<SLADefinition>) => Promise<void>;
  updateSLADefinition: (id: string, data: Partial<SLADefinition>) => Promise<void>;
  deleteSLADefinition: (id: string) => Promise<void>;
  
  // Permissions
  fetchPermissions: () => Promise<void>;
  updatePermission: (id: string, data: Partial<CommunicationPermission>) => Promise<void>;
  
  // Delivery Logs
  fetchDeliveryLogs: () => Promise<void>;
  setDeliveryLogFilters: (filters: Partial<DeliveryLogFilters>) => void;
  
  // Audit Logs
  fetchAuditLogs: () => Promise<void>;
  setAuditLogFilters: (filters: Partial<AuditLogFilters>) => void;
  
  // Statistics
  fetchStats: () => Promise<void>;
  
  // UI
  setSelectedSection: (section: string) => void;
  clearError: () => void;
}

export const useCommunicationsSettingsStore = create<CommunicationsSettingsState>((set, get) => ({
  // Initial State
  channels: [],
  senderIdentities: [],
  consentPolicy: null,
  templates: [],
  automationRules: [],
  slaDefinitions: [],
  permissions: [],
  deliveryLogs: [],
  auditLogs: [],
  stats: null,
  
  isLoading: false,
  error: null,
  selectedSection: 'channels',
  
  templateFilters: {},
  automationFilters: {},
  deliveryLogFilters: {},
  auditLogFilters: {},
  
  // Initialize - Load all data
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().fetchChannels(),
        get().fetchSenderIdentities(),
        get().fetchConsentPolicy(),
        get().fetchTemplates(),
        get().fetchAutomationRules(),
        get().fetchSLADefinitions(),
        get().fetchPermissions(),
        get().fetchStats(),
      ]);
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  // Channels
  fetchChannels: async () => {
    try {
      const channels = await api.getChannels();
      set({ channels });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateChannel: async (id: string, data: Partial<ChannelConfig>) => {
    try {
      const updated = await api.updateChannel(id, data);
      set(state => ({
        channels: state.channels.map(ch => ch.id === id ? updated : ch),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  // Sender Identities
  fetchSenderIdentities: async () => {
    try {
      const identities = await api.getSenderIdentities();
      set({ senderIdentities: identities });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  createSenderIdentity: async (data: Partial<SenderIdentity>) => {
    try {
      const created = await api.createSenderIdentity(data);
      set(state => ({
        senderIdentities: [...state.senderIdentities, created],
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateSenderIdentity: async (id: string, data: Partial<SenderIdentity>) => {
    try {
      const updated = await api.updateSenderIdentity(id, data);
      set(state => ({
        senderIdentities: state.senderIdentities.map(si => si.id === id ? updated : si),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  deleteSenderIdentity: async (id: string) => {
    try {
      await api.deleteSenderIdentity(id);
      set(state => ({
        senderIdentities: state.senderIdentities.filter(si => si.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  // Consent Policy
  fetchConsentPolicy: async () => {
    try {
      const policy = await api.getConsentPolicy();
      set({ consentPolicy: policy });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateConsentPolicy: async (data: Partial<ConsentPolicy>) => {
    try {
      const updated = await api.updateConsentPolicy(data);
      set({ consentPolicy: updated });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  // Templates
  fetchTemplates: async () => {
    try {
      const templates = await api.getTemplates();
      set({ templates });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  createTemplate: async (data: Partial<CommunicationTemplate>) => {
    try {
      const created = await api.createTemplate(data);
      set(state => ({
        templates: [...state.templates, created],
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateTemplate: async (id: string, data: Partial<CommunicationTemplate>) => {
    try {
      const updated = await api.updateTemplate(id, data);
      set(state => ({
        templates: state.templates.map(t => t.id === id ? updated : t),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  deleteTemplate: async (id: string) => {
    try {
      await api.deleteTemplate(id);
      set(state => ({
        templates: state.templates.filter(t => t.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  setTemplateFilters: (filters: Partial<TemplateFilters>) => {
    set(state => ({
      templateFilters: { ...state.templateFilters, ...filters },
    }));
  },
  
  // Automation Rules
  fetchAutomationRules: async () => {
    try {
      const rules = await api.getAutomationRules();
      set({ automationRules: rules });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  createAutomationRule: async (data: Partial<AutomationRule>) => {
    try {
      const created = await api.createAutomationRule(data);
      set(state => ({
        automationRules: [...state.automationRules, created],
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateAutomationRule: async (id: string, data: Partial<AutomationRule>) => {
    try {
      const updated = await api.updateAutomationRule(id, data);
      set(state => ({
        automationRules: state.automationRules.map(r => r.id === id ? updated : r),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  deleteAutomationRule: async (id: string) => {
    try {
      await api.deleteAutomationRule(id);
      set(state => ({
        automationRules: state.automationRules.filter(r => r.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  setAutomationFilters: (filters: Partial<AutomationFilters>) => {
    set(state => ({
      automationFilters: { ...state.automationFilters, ...filters },
    }));
  },
  
  // SLA Definitions
  fetchSLADefinitions: async () => {
    try {
      const slas = await api.getSLADefinitions();
      set({ slaDefinitions: slas });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  createSLADefinition: async (data: Partial<SLADefinition>) => {
    try {
      const created = await api.createSLADefinition(data);
      set(state => ({
        slaDefinitions: [...state.slaDefinitions, created],
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateSLADefinition: async (id: string, data: Partial<SLADefinition>) => {
    try {
      const updated = await api.updateSLADefinition(id, data);
      set(state => ({
        slaDefinitions: state.slaDefinitions.map(s => s.id === id ? updated : s),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  deleteSLADefinition: async (id: string) => {
    try {
      await api.deleteSLADefinition(id);
      set(state => ({
        slaDefinitions: state.slaDefinitions.filter(s => s.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  // Permissions
  fetchPermissions: async () => {
    try {
      const permissions = await api.getPermissions();
      set({ permissions });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updatePermission: async (id: string, data: Partial<CommunicationPermission>) => {
    try {
      const updated = await api.updatePermission(id, data);
      set(state => ({
        permissions: state.permissions.map(p => p.id === id ? updated : p),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  // Delivery Logs
  fetchDeliveryLogs: async () => {
    try {
      const logs = await api.getDeliveryLogs();
      set({ deliveryLogs: logs });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  setDeliveryLogFilters: (filters: Partial<DeliveryLogFilters>) => {
    set(state => ({
      deliveryLogFilters: { ...state.deliveryLogFilters, ...filters },
    }));
  },
  
  // Audit Logs
  fetchAuditLogs: async () => {
    try {
      const logs = await api.getAuditLogs();
      set({ auditLogs: logs });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  setAuditLogFilters: (filters: Partial<AuditLogFilters>) => {
    set(state => ({
      auditLogFilters: { ...state.auditLogFilters, ...filters },
    }));
  },
  
  // Statistics
  fetchStats: async () => {
    try {
      const stats = await api.getStats();
      set({ stats });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  // UI
  setSelectedSection: (section: string) => {
    set({ selectedSection: section });
  },
  
  clearError: () => {
    set({ error: null });
  },
}));
