// Data & Compliance API - MDC Operations Centre

import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { supabase } from '../../../utils/supabase/client';
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

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/data-compliance`;

// Get auth headers dynamically
async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-User-Token': `Bearer ${session?.access_token || ''}`,
  };
}

// --- Dashboard Statistics ---

export async function getStats(): Promise<ComplianceStats> {
  const response = await fetch(`${BASE_URL}/stats`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch statistics');
  return response.json();
}

// --- Data Subject Requests ---

export async function getRequests(): Promise<DataSubjectRequest[]> {
  const response = await fetch(`${BASE_URL}/requests`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch requests');
  return response.json();
}

export async function getRequestById(id: string): Promise<DataSubjectRequest> {
  const response = await fetch(`${BASE_URL}/requests/${id}`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch request');
  return response.json();
}

export async function createRequest(data: Partial<DataSubjectRequest>): Promise<DataSubjectRequest> {
  const response = await fetch(`${BASE_URL}/requests`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create request');
  return response.json();
}

export async function updateRequest(id: string, data: Partial<DataSubjectRequest>): Promise<DataSubjectRequest> {
  const response = await fetch(`${BASE_URL}/requests/${id}`, {
    method: 'PUT',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update request');
  return response.json();
}

export async function getRequestActions(requestId: string): Promise<RequestAction[]> {
  const response = await fetch(`${BASE_URL}/requests/${requestId}/actions`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch request actions');
  return response.json();
}

export async function createRequestAction(requestId: string, data: Partial<RequestAction>): Promise<RequestAction> {
  const response = await fetch(`${BASE_URL}/requests/${requestId}/actions`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create request action');
  return response.json();
}

// --- Data Exports ---

export async function getExports(): Promise<DataExport[]> {
  const response = await fetch(`${BASE_URL}/exports`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch exports');
  return response.json();
}

export async function createExport(data: Partial<DataExport>): Promise<DataExport> {
  const response = await fetch(`${BASE_URL}/exports`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create export');
  return response.json();
}

export async function markExportDownloaded(id: string, downloadedBy: string): Promise<DataExport> {
  const response = await fetch(`${BASE_URL}/exports/${id}/download`, {
    method: 'PUT',
    headers: await getHeaders(),
    body: JSON.stringify({ downloaded_by: downloadedBy }),
  });
  if (!response.ok) throw new Error('Failed to mark export as downloaded');
  return response.json();
}

// --- Access Logs ---

export async function getAccessLogs(): Promise<DataAccessLog[]> {
  const response = await fetch(`${BASE_URL}/access-logs`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch access logs');
  return response.json();
}

export async function createAccessLog(data: Partial<DataAccessLog>): Promise<DataAccessLog> {
  const response = await fetch(`${BASE_URL}/access-logs`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create access log');
  return response.json();
}

// --- Retention Jobs ---

export async function getRetentionJobs(): Promise<RetentionJob[]> {
  const response = await fetch(`${BASE_URL}/retention-jobs`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch retention jobs');
  return response.json();
}

export async function getRetentionJobById(id: string): Promise<RetentionJob> {
  const response = await fetch(`${BASE_URL}/retention-jobs/${id}`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch retention job');
  return response.json();
}

export async function createRetentionJob(data: Partial<RetentionJob>): Promise<RetentionJob> {
  const response = await fetch(`${BASE_URL}/retention-jobs`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create retention job');
  return response.json();
}

export async function executeRetentionJob(id: string): Promise<JobExecution> {
  const response = await fetch(`${BASE_URL}/retention-jobs/${id}/execute`, {
    method: 'POST',
    headers: await getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to execute retention job');
  return response.json();
}

// --- Breaches ---

export async function getBreaches(): Promise<BreachRecord[]> {
  const response = await fetch(`${BASE_URL}/breaches`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch breaches');
  return response.json();
}

export async function getBreachById(id: string): Promise<BreachRecord> {
  const response = await fetch(`${BASE_URL}/breaches/${id}`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch breach');
  return response.json();
}

export async function createBreach(data: Partial<BreachRecord>): Promise<BreachRecord> {
  const response = await fetch(`${BASE_URL}/breaches`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create breach');
  return response.json();
}

export async function updateBreach(id: string, data: Partial<BreachRecord>): Promise<BreachRecord> {
  const response = await fetch(`${BASE_URL}/breaches/${id}`, {
    method: 'PUT',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update breach');
  return response.json();
}

// --- Audit Logs ---

export async function getAuditLogs(): Promise<ComplianceAuditLog[]> {
  const response = await fetch(`${BASE_URL}/audit-logs`, { headers: await getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch audit logs');
  return response.json();
}

// --- Seed Data ---

export async function seedData(): Promise<void> {
  const response = await fetch(`${BASE_URL}/seed`, {
    method: 'POST',
    headers: await getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to seed data');
}