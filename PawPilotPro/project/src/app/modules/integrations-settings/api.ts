// Integrations Settings API - MDC Operations Centre

import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import type {
  CatalogueEntry,
  ConnectedIntegration,
  IntegrationCredential,
  DataScope,
  WebhookConfig,
  SyncConfiguration,
  SyncJob,
  IntegrationLog,
  IntegrationAlert,
  IntegrationAuditLog,
  IntegrationsStats,
} from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/integrations`;

// Statistics
export async function getStats(): Promise<IntegrationsStats> {
  const response = await fetch(`${BASE_URL}/stats`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch statistics');
  return response.json();
}

// Catalogue
export async function getCatalogue(): Promise<CatalogueEntry[]> {
  const response = await fetch(`${BASE_URL}/catalogue`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch catalogue');
  return response.json();
}

// Connected Integrations
export async function getIntegrations(): Promise<ConnectedIntegration[]> {
  const response = await fetch(`${BASE_URL}/integrations`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch integrations');
  return response.json();
}

export async function createIntegration(data: Partial<ConnectedIntegration>): Promise<ConnectedIntegration> {
  const response = await fetch(`${BASE_URL}/integrations`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create integration');
  return response.json();
}

export async function updateIntegration(id: string, data: Partial<ConnectedIntegration>): Promise<ConnectedIntegration> {
  const response = await fetch(`${BASE_URL}/integrations/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update integration');
  return response.json();
}

export async function deleteIntegration(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/integrations/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete integration');
}

// Credentials
export async function getCredentials(): Promise<IntegrationCredential[]> {
  const response = await fetch(`${BASE_URL}/credentials`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch credentials');
  return response.json();
}

export async function createCredential(data: Partial<IntegrationCredential>): Promise<IntegrationCredential> {
  const response = await fetch(`${BASE_URL}/credentials`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create credential');
  return response.json();
}

export async function deleteCredential(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/credentials/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete credential');
}

// Data Scopes
export async function getScopes(): Promise<DataScope[]> {
  const response = await fetch(`${BASE_URL}/scopes`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch scopes');
  return response.json();
}

export async function createScope(data: Partial<DataScope>): Promise<DataScope> {
  const response = await fetch(`${BASE_URL}/scopes`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create scope');
  return response.json();
}

export async function updateScope(id: string, data: Partial<DataScope>): Promise<DataScope> {
  const response = await fetch(`${BASE_URL}/scopes/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update scope');
  return response.json();
}

// Webhooks
export async function getWebhooks(): Promise<WebhookConfig[]> {
  const response = await fetch(`${BASE_URL}/webhooks`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch webhooks');
  return response.json();
}

export async function createWebhook(data: Partial<WebhookConfig>): Promise<WebhookConfig> {
  const response = await fetch(`${BASE_URL}/webhooks`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create webhook');
  return response.json();
}

export async function updateWebhook(id: string, data: Partial<WebhookConfig>): Promise<WebhookConfig> {
  const response = await fetch(`${BASE_URL}/webhooks/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update webhook');
  return response.json();
}

export async function deleteWebhook(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/webhooks/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete webhook');
}

// Sync Configurations
export async function getSyncConfigs(): Promise<SyncConfiguration[]> {
  const response = await fetch(`${BASE_URL}/sync-configs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch sync configurations');
  return response.json();
}

export async function createSyncConfig(data: Partial<SyncConfiguration>): Promise<SyncConfiguration> {
  const response = await fetch(`${BASE_URL}/sync-configs`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create sync configuration');
  return response.json();
}

// Sync Jobs
export async function getSyncJobs(): Promise<SyncJob[]> {
  const response = await fetch(`${BASE_URL}/sync-jobs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch sync jobs');
  return response.json();
}

export async function triggerSync(integrationId: string, syncConfigId: string, triggeredBy: string): Promise<SyncJob> {
  const response = await fetch(`${BASE_URL}/sync-jobs/trigger`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ integration_id: integrationId, sync_config_id: syncConfigId, triggered_by: triggeredBy }),
  });
  if (!response.ok) throw new Error('Failed to trigger sync');
  return response.json();
}

// Logs
export async function getLogs(): Promise<IntegrationLog[]> {
  const response = await fetch(`${BASE_URL}/logs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch logs');
  return response.json();
}

// Alerts
export async function getAlerts(): Promise<IntegrationAlert[]> {
  const response = await fetch(`${BASE_URL}/alerts`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
}

export async function resolveAlert(id: string): Promise<IntegrationAlert> {
  const response = await fetch(`${BASE_URL}/alerts/${id}/resolve`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to resolve alert');
  return response.json();
}

// Audit Logs
export async function getAuditLogs(): Promise<IntegrationAuditLog[]> {
  const response = await fetch(`${BASE_URL}/audit-logs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch audit logs');
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