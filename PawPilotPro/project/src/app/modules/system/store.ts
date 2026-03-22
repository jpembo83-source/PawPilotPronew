// System Menu Store

import { create } from 'zustand';
import type { SystemOverview, Organisation, FeatureFlag, ModuleConfiguration, GlobalDefaults, EnvironmentSettings, BackgroundJob, SystemHealthMetrics, SystemLog, SystemAuditLog } from './types';
import * as api from './api';

interface SystemState {
  overview: SystemOverview | null;
  organisations: Organisation[];
  featureFlags: FeatureFlag[];
  modules: ModuleConfiguration[];
  defaults: GlobalDefaults[];
  environment: EnvironmentSettings | null;
  jobs: BackgroundJob[];
  health: SystemHealthMetrics | null;
  logs: SystemLog[];
  auditLogs: SystemAuditLog[];
  isLoading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  loadOverview: () => Promise<void>;
  loadOrganisations: () => Promise<void>;
  createOrganisation: (data: Partial<Organisation>) => Promise<void>;
  updateOrganisation: (id: string, data: Partial<Organisation>) => Promise<void>;
  suspendOrganisation: (id: string, reason: string) => Promise<void>;
  reactivateOrganisation: (id: string) => Promise<void>;
  loadFeatureFlags: () => Promise<void>;
  updateFeatureFlag: (id: string, data: Partial<FeatureFlag>) => Promise<void>;
  loadModules: () => Promise<void>;
  updateModule: (name: string, data: Partial<ModuleConfiguration>) => Promise<void>;
  loadDefaults: () => Promise<void>;
  loadEnvironment: () => Promise<void>;
  updateEnvironment: (data: Partial<EnvironmentSettings>) => Promise<void>;
  loadJobs: () => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  executeJob: (id: string) => Promise<void>;
  loadHealth: () => Promise<void>;
  loadLogs: () => Promise<void>;
  loadAuditLogs: () => Promise<void>;
  emergencyDisable: (reason: string) => Promise<void>;
  forceLogoutAll: (reason: string) => Promise<void>;
  setMaintenanceMode: (enable: boolean, message: string, reason: string) => Promise<void>;
  seedData: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  overview: null,
  organisations: [],
  featureFlags: [],
  modules: [],
  defaults: [],
  environment: null,
  jobs: [],
  health: null,
  logs: [],
  auditLogs: [],
  isLoading: false,
  error: null,

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      // Load all data - failures are caught individually, so we can continue loading other sections
      await Promise.allSettled([
        get().loadOverview(),
        get().loadOrganisations(),
        get().loadFeatureFlags(),
        get().loadModules(),
        get().loadDefaults(),
        get().loadEnvironment(),
        get().loadJobs(),
        get().loadHealth(),
        get().loadLogs(),
        get().loadAuditLogs(),
      ]);
    } catch (error) {
      console.error('Error loading system data:', error);
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadOverview: async () => {
    try {
      const overview = await api.getOverview();
      set({ overview });
    } catch (error) {
      console.error('Failed to load system overview:', error);
      // Keep null state - UI will show placeholder
    }
  },

  loadOrganisations: async () => {
    try {
      const organisations = await api.getOrganisations();
      set({ organisations });
    } catch (error) {
      console.error('Failed to load organisations:', error);
      // Keep empty array - UI will show empty state
    }
  },

  createOrganisation: async (data) => {
    try {
      const created = await api.createOrganisation(data);
      set((state) => ({ organisations: [...state.organisations, created] }));
      await get().loadOverview();
    } catch (error) {
      console.error('Failed to create organisation:', error);
      set({ error: (error as Error).message });
    }
  },

  updateOrganisation: async (id, data) => {
    try {
      const updated = await api.updateOrganisation(id, data);
      set((state) => ({
        organisations: state.organisations.map((o) => (o.id === id ? updated : o)),
      }));
    } catch (error) {
      console.error('Failed to update organisation:', error);
      set({ error: (error as Error).message });
    }
  },

  suspendOrganisation: async (id, reason) => {
    try {
      const updated = await api.suspendOrganisation(id, reason, 'current-admin');
      set((state) => ({
        organisations: state.organisations.map((o) => (o.id === id ? updated : o)),
      }));
      await get().loadOverview();
    } catch (error) {
      console.error('Failed to suspend organisation:', error);
      set({ error: (error as Error).message });
    }
  },

  reactivateOrganisation: async (id) => {
    try {
      const updated = await api.reactivateOrganisation(id, 'current-admin');
      set((state) => ({
        organisations: state.organisations.map((o) => (o.id === id ? updated : o)),
      }));
      await get().loadOverview();
    } catch (error) {
      console.error('Failed to reactivate organisation:', error);
      set({ error: (error as Error).message });
    }
  },

  loadFeatureFlags: async () => {
    try {
      const featureFlags = await api.getFeatureFlags();
      set({ featureFlags });
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    }
  },

  updateFeatureFlag: async (id, data) => {
    try {
      const updated = await api.updateFeatureFlag(id, data);
      set((state) => ({
        featureFlags: state.featureFlags.map((f) => (f.id === id ? updated : f)),
      }));
    } catch (error) {
      console.error('Failed to update feature flag:', error);
      set({ error: (error as Error).message });
    }
  },

  loadModules: async () => {
    try {
      const modules = await api.getModules();
      set({ modules });
    } catch (error) {
      console.error('Failed to load modules:', error);
    }
  },

  updateModule: async (name, data) => {
    try {
      const updated = await api.updateModule(name, data);
      set((state) => ({
        modules: state.modules.map((m) => (m.module_name === name ? updated : m)),
      }));
    } catch (error) {
      console.error('Failed to update module:', error);
      set({ error: (error as Error).message });
    }
  },

  loadDefaults: async () => {
    try {
      const defaults = await api.getDefaults();
      set({ defaults });
    } catch (error) {
      console.error('Failed to load defaults:', error);
    }
  },

  loadEnvironment: async () => {
    try {
      const environment = await api.getEnvironment();
      set({ environment });
    } catch (error) {
      console.error('Failed to load environment settings:', error);
    }
  },

  updateEnvironment: async (data) => {
    try {
      const updated = await api.updateEnvironment(data);
      set({ environment: updated });
    } catch (error) {
      console.error('Failed to update environment:', error);
      set({ error: (error as Error).message });
    }
  },

  loadJobs: async () => {
    try {
      const jobs = await api.getJobs();
      set({ jobs });
    } catch (error) {
      console.error('Failed to load background jobs:', error);
    }
  },

  pauseJob: async (id) => {
    try {
      const updated = await api.pauseJob(id);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
      }));
    } catch (error) {
      console.error('Failed to pause job:', error);
      set({ error: (error as Error).message });
    }
  },

  resumeJob: async (id) => {
    try {
      const updated = await api.resumeJob(id);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
      }));
    } catch (error) {
      console.error('Failed to resume job:', error);
      set({ error: (error as Error).message });
    }
  },

  executeJob: async (id) => {
    try {
      await api.executeJob(id, 'current-admin');
      await get().loadJobs();
    } catch (error) {
      console.error('Failed to execute job:', error);
      set({ error: (error as Error).message });
    }
  },

  loadHealth: async () => {
    try {
      const health = await api.getHealth();
      set({ health });
    } catch (error) {
      console.error('Failed to load health metrics:', error);
    }
  },

  loadLogs: async () => {
    try {
      const logs = await api.getLogs();
      set({ logs });
    } catch (error) {
      console.error('Failed to load system logs:', error);
    }
  },

  loadAuditLogs: async () => {
    try {
      const auditLogs = await api.getAuditLogs();
      set({ auditLogs });
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  },

  emergencyDisable: async (reason) => {
    try {
      await api.emergencyDisable('current-admin', reason);
      await get().loadAuditLogs();
    } catch (error) {
      console.error('Failed to emergency disable:', error);
      set({ error: (error as Error).message });
    }
  },

  forceLogoutAll: async (reason) => {
    try {
      await api.forceLogoutAll('current-admin', reason);
      await get().loadAuditLogs();
    } catch (error) {
      console.error('Failed to force logout all users:', error);
      set({ error: (error as Error).message });
    }
  },

  setMaintenanceMode: async (enable, message, reason) => {
    try {
      await api.setMaintenanceMode(enable, message, 'current-admin', reason);
      await get().loadEnvironment();
      await get().loadAuditLogs();
    } catch (error) {
      console.error('Failed to set maintenance mode:', error);
      set({ error: (error as Error).message });
    }
  },

  seedData: async () => {
    try {
      await api.seedData();
      await get().loadAll();
    } catch (error) {
      console.error('Failed to seed system data:', error);
      set({ error: (error as Error).message });
    }
  },
}));
