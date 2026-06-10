// Billing & Finance Settings API - MDC Operations Centre

import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import type {
  PaymentProvider,
  InvoiceSettings,
  TaxRule,
  FeeDefinition,
  RefundSettings,
  RefundRecord,
  CreditRecord,
  MembershipBillingRules,
  FinancialPermission,
  ApprovalRule,
  ExportConfiguration,
  ExportRecord,
  FinancialAuditLog,
  AuditControls,
  BillingFinanceStats,
} from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/billing-finance`;

// --- Payment Providers ---

export async function getPaymentProviders(): Promise<PaymentProvider[]> {
  const response = await fetch(`${BASE_URL}/payment-providers`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch payment providers');
  return response.json();
}

export async function updatePaymentProvider(id: string, data: Partial<PaymentProvider>): Promise<PaymentProvider> {
  const response = await fetch(`${BASE_URL}/payment-providers/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update payment provider');
  return response.json();
}

// --- Invoice Settings ---

export async function getInvoiceSettings(): Promise<InvoiceSettings[]> {
  const response = await fetch(`${BASE_URL}/invoice-settings`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch invoice settings');
  return response.json();
}

export async function getInvoiceSettingsById(id: string): Promise<InvoiceSettings> {
  const response = await fetch(`${BASE_URL}/invoice-settings/${id}`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch invoice settings');
  return response.json();
}

export async function updateInvoiceSettings(id: string, data: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
  const response = await fetch(`${BASE_URL}/invoice-settings/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update invoice settings');
  return response.json();
}

// --- Tax Rules ---

export async function getTaxRules(): Promise<TaxRule[]> {
  const response = await fetch(`${BASE_URL}/tax-rules`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch tax rules');
  return response.json();
}

export async function createTaxRule(data: Partial<TaxRule>): Promise<TaxRule> {
  const response = await fetch(`${BASE_URL}/tax-rules`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create tax rule');
  return response.json();
}

export async function updateTaxRule(id: string, data: Partial<TaxRule>): Promise<TaxRule> {
  const response = await fetch(`${BASE_URL}/tax-rules/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update tax rule');
  return response.json();
}

export async function deleteTaxRule(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/tax-rules/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete tax rule');
}

// --- Fees & Penalties ---

export async function getFees(): Promise<FeeDefinition[]> {
  const response = await fetch(`${BASE_URL}/fees`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch fees');
  return response.json();
}

export async function createFee(data: Partial<FeeDefinition>): Promise<FeeDefinition> {
  const response = await fetch(`${BASE_URL}/fees`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create fee');
  return response.json();
}

export async function updateFee(id: string, data: Partial<FeeDefinition>): Promise<FeeDefinition> {
  const response = await fetch(`${BASE_URL}/fees/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update fee');
  return response.json();
}

export async function deleteFee(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/fees/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete fee');
}

// --- Refund Settings ---

export async function getRefundSettings(): Promise<RefundSettings | null> {
  const response = await fetch(`${BASE_URL}/refund-settings`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch refund settings');
  return response.json();
}

export async function updateRefundSettings(data: Partial<RefundSettings>): Promise<RefundSettings> {
  const response = await fetch(`${BASE_URL}/refund-settings`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update refund settings');
  return response.json();
}

// --- Refund Records ---

export async function getRefunds(): Promise<RefundRecord[]> {
  const response = await fetch(`${BASE_URL}/refunds`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch refunds');
  return response.json();
}

export async function createRefund(data: Partial<RefundRecord>): Promise<RefundRecord> {
  const response = await fetch(`${BASE_URL}/refunds`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create refund');
  return response.json();
}

// --- Credit Records ---

export async function getCredits(): Promise<CreditRecord[]> {
  const response = await fetch(`${BASE_URL}/credits`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch credits');
  return response.json();
}

export async function createCredit(data: Partial<CreditRecord>): Promise<CreditRecord> {
  const response = await fetch(`${BASE_URL}/credits`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create credit');
  return response.json();
}

// --- Membership Billing Rules ---

export async function getMembershipBillingRules(): Promise<MembershipBillingRules | null> {
  const response = await fetch(`${BASE_URL}/membership-billing-rules`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch membership billing rules');
  return response.json();
}

export async function updateMembershipBillingRules(data: Partial<MembershipBillingRules>): Promise<MembershipBillingRules> {
  const response = await fetch(`${BASE_URL}/membership-billing-rules`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update membership billing rules');
  return response.json();
}

// --- Financial Permissions ---

export async function getPermissions(): Promise<FinancialPermission[]> {
  const response = await fetch(`${BASE_URL}/permissions`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch permissions');
  return response.json();
}

export async function updatePermission(id: string, data: Partial<FinancialPermission>): Promise<FinancialPermission> {
  const response = await fetch(`${BASE_URL}/permissions/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update permission');
  return response.json();
}

// --- Approval Rules ---

export async function getApprovalRules(): Promise<ApprovalRule[]> {
  const response = await fetch(`${BASE_URL}/approval-rules`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch approval rules');
  return response.json();
}

export async function createApprovalRule(data: Partial<ApprovalRule>): Promise<ApprovalRule> {
  const response = await fetch(`${BASE_URL}/approval-rules`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create approval rule');
  return response.json();
}

export async function updateApprovalRule(id: string, data: Partial<ApprovalRule>): Promise<ApprovalRule> {
  const response = await fetch(`${BASE_URL}/approval-rules/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update approval rule');
  return response.json();
}

export async function deleteApprovalRule(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/approval-rules/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete approval rule');
}

// --- Export Configurations ---

export async function getExportConfigs(): Promise<ExportConfiguration[]> {
  const response = await fetch(`${BASE_URL}/export-configs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch export configurations');
  return response.json();
}

export async function createExportConfig(data: Partial<ExportConfiguration>): Promise<ExportConfiguration> {
  const response = await fetch(`${BASE_URL}/export-configs`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create export configuration');
  return response.json();
}

export async function updateExportConfig(id: string, data: Partial<ExportConfiguration>): Promise<ExportConfiguration> {
  const response = await fetch(`${BASE_URL}/export-configs/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update export configuration');
  return response.json();
}

export async function deleteExportConfig(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/export-configs/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete export configuration');
}

// --- Export Records ---

export async function getExports(): Promise<ExportRecord[]> {
  const response = await fetch(`${BASE_URL}/exports`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch export records');
  return response.json();
}

export async function createExport(data: Partial<ExportRecord>): Promise<ExportRecord> {
  const response = await fetch(`${BASE_URL}/exports`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create export record');
  return response.json();
}

// --- Audit Controls ---

export async function getAuditControls(): Promise<AuditControls | null> {
  const response = await fetch(`${BASE_URL}/audit-controls`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch audit controls');
  return response.json();
}

export async function updateAuditControls(data: Partial<AuditControls>): Promise<AuditControls> {
  const response = await fetch(`${BASE_URL}/audit-controls`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update audit controls');
  return response.json();
}

// --- Audit Logs ---

export async function getAuditLogs(): Promise<FinancialAuditLog[]> {
  const response = await fetch(`${BASE_URL}/audit-logs`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch audit logs');
  return response.json();
}

// --- Statistics ---

export async function getStats(): Promise<BillingFinanceStats> {
  const response = await fetch(`${BASE_URL}/stats`, { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch statistics');
  return response.json();
}

// --- Seed Data ---

export async function seedData(): Promise<void> {
  const response = await fetch(`${BASE_URL}/seed`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to seed data');
}
