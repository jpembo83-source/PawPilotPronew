import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import type {
  OperationalRule,
  RuleAudit,
  RuleTemplate,
  RulesFilters,
  RuleEvaluationContext,
  RuleEvaluationResponse,
  LocationOverrideConfig
} from './types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/operational-rules`;

// ============================================================================
// RULES CRUD
// ============================================================================

export async function fetchRules(filters?: RulesFilters): Promise<{ rules: OperationalRule[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.module) params.append('module', filters.module);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.scope) params.append('scope', filters.scope);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.locationId) params.append('locationId', filters.locationId);
  if (filters?.search) params.append('search', filters.search);
  
  const url = `${API_BASE}?${params.toString()}`;
  const response = await fetch(url, { headers: await getAuthHeaders() });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch rules');
  }
  
  return response.json();
}

export async function fetchRule(ruleId: string): Promise<OperationalRule> {
  const response = await fetch(`${API_BASE}/${ruleId}`, {
    headers: await getAuthHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch rule');
  }
  
  return response.json();
}

export async function createRule(data: {
  name: string;
  description: string;
  module: string;
  category: string;
  type: string;
  scope: string;
  scopeId: string;
  scopeName: string;
  allowLocationOverride?: boolean;
  event: string;
  conditions: any[];
  actions: any[];
  customerTiers?: string[];
  serviceTypes?: string[];
  status?: string;
  isOverride?: boolean;
  overridesRuleId?: string;
  priority?: number;
  createdBy: string;
  createdByName: string;
  auditReason?: string;
}): Promise<OperationalRule> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create rule');
  }
  
  return response.json();
}

export async function updateRule(
  ruleId: string,
  updates: Partial<OperationalRule> & {
    updatedBy: string;
    updatedByName: string;
    auditReason?: string;
    disabledReason?: string;
  }
): Promise<OperationalRule> {
  const response = await fetch(`${API_BASE}/${ruleId}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update rule');
  }
  
  return response.json();
}

export async function deleteRule(
  ruleId: string,
  deletedBy: string,
  deletedByName: string,
  reason: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/${ruleId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ deletedBy, deletedByName, reason })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete rule');
  }
}

// ============================================================================
// RULE EVALUATION
// ============================================================================

export async function evaluateRules(context: RuleEvaluationContext): Promise<RuleEvaluationResponse> {
  const response = await fetch(`${API_BASE}/evaluate`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(context)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to evaluate rules');
  }
  
  return response.json();
}

// ============================================================================
// LOCATION OVERRIDES
// ============================================================================

export async function fetchLocationOverrides(locationId: string): Promise<{ configs: LocationOverrideConfig[] }> {
  const response = await fetch(`${API_BASE}/overrides/${locationId}`, {
    headers: await getAuthHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch location overrides');
  }
  
  return response.json();
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export async function fetchAuditLog(filters?: {
  ruleId?: string;
  scope?: string;
  locationId?: string;
  limit?: number;
}): Promise<{ audits: RuleAudit[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.ruleId) params.append('ruleId', filters.ruleId);
  if (filters?.scope) params.append('scope', filters.scope);
  if (filters?.locationId) params.append('locationId', filters.locationId);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  
  const url = `${API_BASE}/audit?${params.toString()}`;
  const response = await fetch(url, { headers: await getAuthHeaders() });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch audit log');
  }
  
  return response.json();
}

// ============================================================================
// RULE TEMPLATES
// ============================================================================

export async function fetchTemplates(filters?: {
  module?: string;
  category?: string;
}): Promise<{ templates: RuleTemplate[] }> {
  const params = new URLSearchParams();
  if (filters?.module) params.append('module', filters.module);
  if (filters?.category) params.append('category', filters.category);
  
  const url = `${API_BASE}/templates?${params.toString()}`;
  const response = await fetch(url, { headers: await getAuthHeaders() });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch templates');
  }
  
  return response.json();
}
