// Integrations Settings Store

import { create } from 'zustand';
import type { CatalogueEntry, ConnectedIntegration, IntegrationCredential, DataScope, WebhookConfig, SyncConfiguration, SyncJob, IntegrationLog, IntegrationAlert, IntegrationAuditLog, IntegrationsStats } from './types';
import * as api from './api';

interface IntegrationsSettingsState {
  catalogue: CatalogueEntry[];
  integrations: ConnectedIntegration[];
  credentials: IntegrationCredential[];
  scopes: DataScope[];
  webhooks: WebhookConfig[];
  syncConfigs: SyncConfiguration[];
  syncJobs: SyncJob[];
  logs: IntegrationLog[];
  alerts: IntegrationAlert[];
  auditLogs: IntegrationAuditLog[];
  stats: IntegrationsStats | null;
  isLoading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadCatalogue: () => Promise<void>;
  loadIntegrations: () => Promise<void>;
  createIntegration: (data: Partial<ConnectedIntegration>) => Promise<void>;
  updateIntegration: (id: string, data: Partial<ConnectedIntegration>) => Promise<void>;
  deleteIntegration: (id: string) => Promise<void>;
  loadCredentials: () => Promise<void>;
  createCredential: (data: Partial<IntegrationCredential>) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
  loadScopes: () => Promise<void>;
  createScope: (data: Partial<DataScope>) => Promise<void>;
  updateScope: (id: string, data: Partial<DataScope>) => Promise<void>;
  loadWebhooks: () => Promise<void>;
  createWebhook: (data: Partial<WebhookConfig>) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  loadSyncConfigs: () => Promise<void>;
  loadSyncJobs: () => Promise<void>;
  triggerSync: (integrationId: string, syncConfigId: string) => Promise<void>;
  loadLogs: () => Promise<void>;
  loadAlerts: () => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  loadAuditLogs: () => Promise<void>;
  seedData: () => Promise<void>;
}

export const useIntegrationsSettingsStore = create<IntegrationsSettingsState>((set, get) => ({
  catalogue: [],
  integrations: [],
  credentials: [],
  scopes: [],
  webhooks: [],
  syncConfigs: [],
  syncJobs: [],
  logs: [],
  alerts: [],
  auditLogs: [],
  stats: null,
  isLoading: false,
  error: null,

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().loadStats(),
        get().loadCatalogue(),
        get().loadIntegrations(),
        get().loadCredentials(),
        get().loadScopes(),
        get().loadWebhooks(),
        get().loadSyncConfigs(),
        get().loadSyncJobs(),
        get().loadLogs(),
        get().loadAlerts(),
        get().loadAuditLogs(),
      ]);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadStats: async () => {
    try {
      const stats = await api.getStats();
      set({ stats });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadCatalogue: async () => {
    try {
      const catalogue = await api.getCatalogue();
      set({ catalogue });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadIntegrations: async () => {
    try {
      const integrations = await api.getIntegrations();
      set({ integrations });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createIntegration: async (data) => {
    try {
      const created = await api.createIntegration(data);
      set((state) => ({ integrations: [...state.integrations, created] }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateIntegration: async (id, data) => {
    try {
      const updated = await api.updateIntegration(id, data);
      set((state) => ({
        integrations: state.integrations.map((i) => (i.id === id ? updated : i)),
      }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteIntegration: async (id) => {
    try {
      await api.deleteIntegration(id);
      set((state) => ({
        integrations: state.integrations.filter((i) => i.id !== id),
      }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadCredentials: async () => {
    try {
      const credentials = await api.getCredentials();
      set({ credentials });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createCredential: async (data) => {
    try {
      const created = await api.createCredential(data);
      set((state) => ({ credentials: [...state.credentials, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteCredential: async (id) => {
    try {
      await api.deleteCredential(id);
      set((state) => ({
        credentials: state.credentials.filter((c) => c.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadScopes: async () => {
    try {
      const scopes = await api.getScopes();
      set({ scopes });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createScope: async (data) => {
    try {
      const created = await api.createScope(data);
      set((state) => ({ scopes: [...state.scopes, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateScope: async (id, data) => {
    try {
      const updated = await api.updateScope(id, data);
      set((state) => ({
        scopes: state.scopes.map((s) => (s.id === id ? updated : s)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadWebhooks: async () => {
    try {
      const webhooks = await api.getWebhooks();
      set({ webhooks });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createWebhook: async (data) => {
    try {
      const created = await api.createWebhook(data);
      set((state) => ({ webhooks: [...state.webhooks, created] }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteWebhook: async (id) => {
    try {
      await api.deleteWebhook(id);
      set((state) => ({
        webhooks: state.webhooks.filter((w) => w.id !== id),
      }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadSyncConfigs: async () => {
    try {
      const syncConfigs = await api.getSyncConfigs();
      set({ syncConfigs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadSyncJobs: async () => {
    try {
      const syncJobs = await api.getSyncJobs();
      set({ syncJobs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  triggerSync: async (integrationId, syncConfigId) => {
    try {
      await api.triggerSync(integrationId, syncConfigId, 'current-user');
      // Reload jobs after triggering
      setTimeout(() => get().loadSyncJobs(), 3500);
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadLogs: async () => {
    try {
      const logs = await api.getLogs();
      set({ logs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadAlerts: async () => {
    try {
      const alerts = await api.getAlerts();
      set({ alerts });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  resolveAlert: async (id) => {
    try {
      const updated = await api.resolveAlert(id);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? updated : a)),
      }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadAuditLogs: async () => {
    try {
      const auditLogs = await api.getAuditLogs();
      set({ auditLogs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  seedData: async () => {
    try {
      await api.seedData();
      await get().loadAll();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
