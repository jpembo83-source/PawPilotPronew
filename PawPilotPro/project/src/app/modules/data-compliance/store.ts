// Data & Compliance Store - MDC Operations Centre

import { create } from 'zustand';
import type {
  DataSubjectRequest,
  RequestAction,
  DataExport,
  DataAccessLog,
  RetentionJob,
  JobExecution,
  BreachRecord,
  ComplianceAuditLog,
  ComplianceStats,
} from './types';
import * as api from './api';

interface DataComplianceState {
  // Data
  requests: DataSubjectRequest[];
  exports: DataExport[];
  accessLogs: DataAccessLog[];
  retentionJobs: RetentionJob[];
  breaches: BreachRecord[];
  auditLogs: ComplianceAuditLog[];
  stats: ComplianceStats | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  loadAll: () => Promise<void>;
  loadStats: () => Promise<void>;
  
  loadRequests: () => Promise<void>;
  createRequest: (data: Partial<DataSubjectRequest>) => Promise<void>;
  updateRequest: (id: string, data: Partial<DataSubjectRequest>) => Promise<void>;
  loadRequestActions: (requestId: string) => Promise<RequestAction[]>;
  createRequestAction: (requestId: string, data: Partial<RequestAction>) => Promise<void>;
  
  loadExports: () => Promise<void>;
  createExport: (data: Partial<DataExport>) => Promise<DataExport | null>;
  markExportDownloaded: (id: string, downloadedBy: string) => Promise<void>;
  
  loadAccessLogs: () => Promise<void>;
  
  loadRetentionJobs: () => Promise<void>;
  createRetentionJob: (data: Partial<RetentionJob>) => Promise<void>;
  executeRetentionJob: (
    id: string,
    options?: { dryRun?: boolean; confirm?: boolean },
  ) => Promise<JobExecution | null>;
  
  loadBreaches: () => Promise<void>;
  createBreach: (data: Partial<BreachRecord>) => Promise<void>;
  updateBreach: (id: string, data: Partial<BreachRecord>) => Promise<void>;
  
  loadAuditLogs: () => Promise<void>;
  
  seedData: () => Promise<void>;
}

export const useDataComplianceStore = create<DataComplianceState>((set, get) => ({
  // Initial state
  requests: [],
  exports: [],
  accessLogs: [],
  retentionJobs: [],
  breaches: [],
  auditLogs: [],
  stats: null,
  isLoading: false,
  error: null,

  // Load all data
  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().loadStats(),
        get().loadRequests(),
        get().loadExports(),
        get().loadAccessLogs(),
        get().loadRetentionJobs(),
        get().loadBreaches(),
        get().loadAuditLogs(),
      ]);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
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

  // Data Subject Requests
  loadRequests: async () => {
    try {
      const requests = await api.getRequests();
      set({ requests });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createRequest: async (data) => {
    try {
      const created = await api.createRequest(data);
      set((state) => ({ requests: [created, ...state.requests] }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateRequest: async (id, data) => {
    try {
      const updated = await api.updateRequest(id, data);
      set((state) => ({
        requests: state.requests.map((r) => (r.id === id ? updated : r)),
      }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadRequestActions: async (requestId) => {
    try {
      return await api.getRequestActions(requestId);
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },

  createRequestAction: async (requestId, data) => {
    try {
      await api.createRequestAction(requestId, data);
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Data Exports
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
      set((state) => ({ exports: [created, ...state.exports] }));
      await get().loadStats();
      return created;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  markExportDownloaded: async (id, downloadedBy) => {
    try {
      const updated = await api.markExportDownloaded(id, downloadedBy);
      set((state) => ({
        exports: state.exports.map((e) => (e.id === id ? updated : e)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Access Logs
  loadAccessLogs: async () => {
    try {
      const accessLogs = await api.getAccessLogs();
      set({ accessLogs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // Retention Jobs
  loadRetentionJobs: async () => {
    try {
      const retentionJobs = await api.getRetentionJobs();
      set({ retentionJobs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createRetentionJob: async (data) => {
    try {
      const created = await api.createRetentionJob(data);
      set((state) => ({ retentionJobs: [...state.retentionJobs, created] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  executeRetentionJob: async (id, options) => {
    try {
      const execution = await api.executeRetentionJob(id, options);
      // A dry run changes nothing, so only real runs refresh job metrics.
      if (!execution.dry_run) {
        await get().loadRetentionJobs();
        await get().loadStats();
      }
      return execution;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  // Breaches
  loadBreaches: async () => {
    try {
      const breaches = await api.getBreaches();
      set({ breaches });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createBreach: async (data) => {
    try {
      const created = await api.createBreach(data);
      set((state) => ({ breaches: [created, ...state.breaches] }));
      await get().loadStats();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateBreach: async (id, data) => {
    try {
      const updated = await api.updateBreach(id, data);
      set((state) => ({
        breaches: state.breaches.map((b) => (b.id === id ? updated : b)),
      }));
      await get().loadStats();
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
