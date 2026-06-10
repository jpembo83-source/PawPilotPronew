// System Settings API - MDC Operations Centre

import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import type { SystemOverview, Organisation, FeatureFlag, ModuleConfiguration, GlobalDefaults, EnvironmentSettings, BackgroundJob, SystemHealthMetrics, SystemLog, SystemAuditLog, SystemActionExecution } from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/system`;

// System Overview
export async function getOverview(): Promise<SystemOverview> {
  const response = await fetch(`${BASE_URL}/overview`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch overview');
  return response.json();
}

// Organisations
export async function getOrganisations(): Promise<Organisation[]> {
  const response = await fetch(`${BASE_URL}/organisations`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch organisations');
  return response.json();
}

export async function createOrganisation(data: Partial<Organisation>): Promise<Organisation> {
  const response = await fetch(`${BASE_URL}/organisations`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create organisation');
  return response.json();
}

export async function updateOrganisation(id: string, data: Partial<Organisation>): Promise<Organisation> {
  const response = await fetch(`${BASE_URL}/organisations/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update organisation');
  return response.json();
}

export async function suspendOrganisation(id: string, reason: string, suspendedBy: string): Promise<Organisation> {
  const response = await fetch(`${BASE_URL}/organisations/${id}/suspend`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ reason, suspended_by: suspendedBy }),
  });
  if (!response.ok) throw new Error('Failed to suspend organisation');
  return response.json();
}

export async function reactivateOrganisation(id: string, reactivatedBy: string): Promise<Organisation> {
  const response = await fetch(`${BASE_URL}/organisations/${id}/reactivate`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ reactivated_by: reactivatedBy }),
  });
  if (!response.ok) throw new Error('Failed to reactivate organisation');
  return response.json();
}

// Feature Flags
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const response = await fetch(`${BASE_URL}/feature-flags`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch feature flags');
  return response.json();
}

export async function createFeatureFlag(data: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const response = await fetch(`${BASE_URL}/feature-flags`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create feature flag');
  return response.json();
}

export async function updateFeatureFlag(id: string, data: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const response = await fetch(`${BASE_URL}/feature-flags/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update feature flag');
  return response.json();
}

// Modules
export async function getModules(): Promise<ModuleConfiguration[]> {
  const response = await fetch(`${BASE_URL}/modules`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch modules');
  return response.json();
}

export async function updateModule(name: string, data: Partial<ModuleConfiguration>): Promise<ModuleConfiguration> {
  const response = await fetch(`${BASE_URL}/modules/${name}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update module');
  return response.json();
}

// Global Defaults
export async function getDefaults(): Promise<GlobalDefaults[]> {
  const response = await fetch(`${BASE_URL}/defaults`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch defaults');
  return response.json();
}

export async function updateDefault(id: string, data: Partial<GlobalDefaults>): Promise<GlobalDefaults> {
  const response = await fetch(`${BASE_URL}/defaults/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update default');
  return response.json();
}

// Environment & Security
export async function getEnvironment(): Promise<EnvironmentSettings> {
  const response = await fetch(`${BASE_URL}/environment`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch environment settings');
  return response.json();
}

export async function updateEnvironment(data: Partial<EnvironmentSettings>): Promise<EnvironmentSettings> {
  const response = await fetch(`${BASE_URL}/environment`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update environment settings');
  return response.json();
}

// Background Jobs
export async function getJobs(): Promise<BackgroundJob[]> {
  const response = await fetch(`${BASE_URL}/jobs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch jobs');
  return response.json();
}

export async function pauseJob(id: string): Promise<BackgroundJob> {
  const response = await fetch(`${BASE_URL}/jobs/${id}/pause`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to pause job');
  return response.json();
}

export async function resumeJob(id: string): Promise<BackgroundJob> {
  const response = await fetch(`${BASE_URL}/jobs/${id}/resume`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to resume job');
  return response.json();
}

export async function executeJob(id: string, triggeredBy: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/jobs/${id}/execute`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ triggered_by: triggeredBy }),
  });
  if (!response.ok) throw new Error('Failed to execute job');
  return response.json();
}

// System Health
export async function getHealth(): Promise<SystemHealthMetrics> {
  const response = await fetch(`${BASE_URL}/health`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch health metrics');
  return response.json();
}

// Logs
export async function getLogs(): Promise<SystemLog[]> {
  const response = await fetch(`${BASE_URL}/logs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch logs');
  return response.json();
}

export async function getAuditLogs(): Promise<SystemAuditLog[]> {
  const response = await fetch(`${BASE_URL}/audit-logs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch audit logs');
  return response.json();
}

// System Actions
export async function emergencyDisable(executedBy: string, reason: string): Promise<SystemActionExecution> {
  const response = await fetch(`${BASE_URL}/actions/emergency-disable`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ executed_by: executedBy, reason }),
  });
  if (!response.ok) throw new Error('Failed to execute emergency disable');
  return response.json();
}

export async function forceLogoutAll(executedBy: string, reason: string): Promise<SystemActionExecution> {
  const response = await fetch(`${BASE_URL}/actions/force-logout`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ executed_by: executedBy, reason }),
  });
  if (!response.ok) throw new Error('Failed to force logout');
  return response.json();
}

export async function setMaintenanceMode(enable: boolean, message: string, executedBy: string, reason: string): Promise<SystemActionExecution> {
  const response = await fetch(`${BASE_URL}/actions/maintenance-mode`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ enable, message, executed_by: executedBy, reason }),
  });
  if (!response.ok) throw new Error('Failed to set maintenance mode');
  return response.json();
}

// Seed Data
export async function seedData(): Promise<void> {
  const response = await fetch(`${BASE_URL}/seed`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to seed data');
}