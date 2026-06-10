import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { projectId } from '../../../../utils/supabase/info';
import type {
  MessageThread,
  Message,
  MessageTemplate,
  MessageFilters,
  ContactConsent,
  ComposeMessageRequest
} from './types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/messaging`;

// ============================================================================
// THREADS
// ============================================================================

export async function fetchThreads(filters?: MessageFilters): Promise<{ threads: MessageThread[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.locationId) params.append('locationId', filters.locationId);
  if (filters?.module) params.append('module', filters.module);
  if (filters?.channel) params.append('channel', filters.channel);
  if (filters?.unreadOnly) params.append('unreadOnly', 'true');
  if (filters?.awaitingResponseOnly) params.append('awaitingResponseOnly', 'true');
  if (filters?.slaBreachedOnly) params.append('slaBreachedOnly', 'true');
  if (filters?.householdId) params.append('householdId', filters.householdId);
  if (filters?.search) params.append('search', filters.search);
  
  const url = `${API_BASE}/threads?${params.toString()}`;
  const response = await fetch(url, { headers: await getAuthHeaders() });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch threads');
  }
  
  return response.json();
}

export async function fetchThread(threadId: string): Promise<MessageThread> {
  const response = await fetch(`${API_BASE}/threads/${threadId}`, {
    headers: await getAuthHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch thread');
  }
  
  return response.json();
}

export async function createThread(data: {
  householdId: string;
  householdName: string;
  context: any;
  customerContactIds?: string[];
  subject?: string;
  channel?: string;
  priority?: string;
  locationId: string;
  module?: string;
  createdBy: string;
}): Promise<MessageThread> {
  const response = await fetch(`${API_BASE}/threads`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create thread');
  }
  
  return response.json();
}

export async function updateThread(threadId: string, updates: Partial<MessageThread>): Promise<MessageThread> {
  const response = await fetch(`${API_BASE}/threads/${threadId}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update thread');
  }
  
  return response.json();
}

// ============================================================================
// MESSAGES
// ============================================================================

export async function fetchMessages(threadId: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    headers: await getAuthHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch messages');
  }
  
  const data = await response.json();
  return data.messages;
}

export async function sendMessage(data: {
  threadId: string;
  content: string;
  channel: string;
  type?: string;
  senderId: string;
  senderName: string;
  senderType?: string;
  recipientContactId?: string;
  recipientName?: string;
  templateId?: string;
  context?: any;
  locationId: string;
  metadata?: any;
}): Promise<Message> {
  const response = await fetch(`${API_BASE}/threads/${data.threadId}/messages`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to send message');
  }
  
  return response.json();
}

// ============================================================================
// TEMPLATES
// ============================================================================

export async function fetchTemplates(filters?: {
  module?: string;
  category?: string;
  channel?: string;
  activeOnly?: boolean;
}): Promise<MessageTemplate[]> {
  const params = new URLSearchParams();
  if (filters?.module) params.append('module', filters.module);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.channel) params.append('channel', filters.channel);
  if (filters?.activeOnly) params.append('activeOnly', 'true');
  
  const url = `${API_BASE}/templates?${params.toString()}`;
  const response = await fetch(url, { headers: await getAuthHeaders() });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch templates');
  }
  
  const data = await response.json();
  return data.templates;
}

export async function createTemplate(data: {
  name: string;
  description: string;
  category: string;
  module?: string;
  subject?: string;
  body: string;
  variables?: string[];
  channels: string[];
  isAutomated?: boolean;
  isMandatory?: boolean;
  requiredPermission?: any;
  allowedRoles?: string[];
  createdBy: string;
}): Promise<MessageTemplate> {
  const response = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  
  return response.json();
}

export async function updateTemplate(templateId: string, updates: Partial<MessageTemplate> & { updatedBy: string }): Promise<MessageTemplate> {
  const response = await fetch(`${API_BASE}/templates/${templateId}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }
  
  return response.json();
}

// ============================================================================
// CONSENT
// ============================================================================

export async function fetchConsent(contactId: string): Promise<ContactConsent> {
  const response = await fetch(`${API_BASE}/consent/${contactId}`, {
    headers: await getAuthHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch consent');
  }
  
  return response.json();
}

export async function updateConsent(contactId: string, data: {
  householdId: string;
  emailConsent?: boolean;
  smsConsent?: boolean;
  whatsappConsent?: boolean;
  pushConsent?: boolean;
  emailAddress?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  updatedBy: string;
}): Promise<ContactConsent> {
  const response = await fetch(`${API_BASE}/consent/${contactId}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update consent');
  }
  
  return response.json();
}

// ============================================================================
// STATS
// ============================================================================

export async function fetchStats(locationId?: string): Promise<{
  total: number;
  unread: number;
  awaitingResponse: number;
  slaBreached: number;
  byChannel: Record<string, number>;
  byPriority: Record<string, number>;
}> {
  const params = new URLSearchParams();
  if (locationId) params.append('locationId', locationId);
  
  const url = `${API_BASE}/stats?${params.toString()}`;
  const response = await fetch(url, { headers: await getAuthHeaders() });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch stats');
  }
  
  return response.json();
}

// ============================================================================
// HELPER: Render template with variables
// ============================================================================

export function renderTemplate(template: MessageTemplate, variables: Record<string, string>): string {
  let rendered = template.body;
  
  // Replace all {{variableName}} with actual values
  template.variables.forEach(varName => {
    const regex = new RegExp(`{{${varName}}}`, 'g');
    rendered = rendered.replace(regex, variables[varName] || `{{${varName}}}`);
  });
  
  return rendered;
}