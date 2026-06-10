// Communications Settings API - MDC Operations Centre

import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
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
} from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/communications`;

// --- Channels ---

export async function getChannels(): Promise<ChannelConfig[]> {
  const response = await fetch(`${BASE_URL}/channels`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch channels');
  return response.json();
}

export async function updateChannel(id: string, data: Partial<ChannelConfig>): Promise<ChannelConfig> {
  const response = await fetch(`${BASE_URL}/channels/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update channel');
  return response.json();
}

// --- Sender Identities ---

export async function getSenderIdentities(): Promise<SenderIdentity[]> {
  const response = await fetch(`${BASE_URL}/sender-identities`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch sender identities');
  return response.json();
}

export async function createSenderIdentity(data: Partial<SenderIdentity>): Promise<SenderIdentity> {
  const response = await fetch(`${BASE_URL}/sender-identities`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create sender identity');
  return response.json();
}

export async function updateSenderIdentity(id: string, data: Partial<SenderIdentity>): Promise<SenderIdentity> {
  const response = await fetch(`${BASE_URL}/sender-identities/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update sender identity');
  return response.json();
}

export async function deleteSenderIdentity(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/sender-identities/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete sender identity');
}

// --- Consent Policy ---

export async function getConsentPolicy(): Promise<ConsentPolicy> {
  const response = await fetch(`${BASE_URL}/consent-policy`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch consent policy');
  return response.json();
}

export async function updateConsentPolicy(data: Partial<ConsentPolicy>): Promise<ConsentPolicy> {
  const response = await fetch(`${BASE_URL}/consent-policy`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update consent policy');
  return response.json();
}

// --- Templates ---

export async function getTemplates(): Promise<CommunicationTemplate[]> {
  const response = await fetch(`${BASE_URL}/templates`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch templates');
  return response.json();
}

export async function getTemplate(id: string): Promise<CommunicationTemplate> {
  const response = await fetch(`${BASE_URL}/templates/${id}`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch template');
  return response.json();
}

export async function createTemplate(data: Partial<CommunicationTemplate>): Promise<CommunicationTemplate> {
  const response = await fetch(`${BASE_URL}/templates`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create template');
  return response.json();
}

export async function updateTemplate(id: string, data: Partial<CommunicationTemplate>): Promise<CommunicationTemplate> {
  const response = await fetch(`${BASE_URL}/templates/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update template');
  return response.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/templates/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete template');
}

// --- Automation Rules ---

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const response = await fetch(`${BASE_URL}/automation`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch automation rules');
  return response.json();
}

export async function getAutomationRule(id: string): Promise<AutomationRule> {
  const response = await fetch(`${BASE_URL}/automation/${id}`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch automation rule');
  return response.json();
}

export async function createAutomationRule(data: Partial<AutomationRule>): Promise<AutomationRule> {
  const response = await fetch(`${BASE_URL}/automation`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create automation rule');
  return response.json();
}

export async function updateAutomationRule(id: string, data: Partial<AutomationRule>): Promise<AutomationRule> {
  const response = await fetch(`${BASE_URL}/automation/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update automation rule');
  return response.json();
}

export async function deleteAutomationRule(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/automation/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete automation rule');
}

// --- SLA Definitions ---

export async function getSLADefinitions(): Promise<SLADefinition[]> {
  const response = await fetch(`${BASE_URL}/slas`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch SLA definitions');
  return response.json();
}

export async function createSLADefinition(data: Partial<SLADefinition>): Promise<SLADefinition> {
  const response = await fetch(`${BASE_URL}/slas`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create SLA definition');
  return response.json();
}

export async function updateSLADefinition(id: string, data: Partial<SLADefinition>): Promise<SLADefinition> {
  const response = await fetch(`${BASE_URL}/slas/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update SLA definition');
  return response.json();
}

export async function deleteSLADefinition(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/slas/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete SLA definition');
}

// --- Permissions ---

export async function getPermissions(): Promise<CommunicationPermission[]> {
  const response = await fetch(`${BASE_URL}/permissions`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch permissions');
  return response.json();
}

export async function updatePermission(id: string, data: Partial<CommunicationPermission>): Promise<CommunicationPermission> {
  const response = await fetch(`${BASE_URL}/permissions/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update permission');
  return response.json();
}

// --- Delivery Logs ---

export async function getDeliveryLogs(): Promise<CommunicationDeliveryLog[]> {
  const response = await fetch(`${BASE_URL}/delivery-logs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch delivery logs');
  return response.json();
}

// --- Audit Logs ---

export async function getAuditLogs(): Promise<CommunicationAuditLog[]> {
  const response = await fetch(`${BASE_URL}/audit-logs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch audit logs');
  return response.json();
}

// --- Statistics ---

export async function getStats(): Promise<CommunicationStats> {
  const response = await fetch(`${BASE_URL}/stats`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch statistics');
  return response.json();
}