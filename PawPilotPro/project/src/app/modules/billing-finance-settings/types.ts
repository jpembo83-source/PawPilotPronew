// Billing & Finance Settings Types - MDC Operations Centre

export type Currency = 'CHF' | 'EUR' | 'GBP' | 'USD';

export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'sepa_direct_debit' | 'bank_transfer';

export type InvoiceTimingMode = 'immediate' | 'monthly_consolidated' | 'hybrid';

export type InvoiceDueTerm = 'immediate' | 'net_7' | 'net_14' | 'net_30' | 'net_60';

export type RefundMethod = 'original_payment_method' | 'account_credit';

export type ExportFormat = 'csv' | 'datev' | 'xero' | 'quickbooks';

export type ExportSchedule = 'daily' | 'weekly' | 'monthly' | 'manual';

// --- Payment Providers ---

export interface PaymentProvider {
  id: string;
  provider_name: 'stripe' | 'bank_transfer';
  enabled: boolean;
  environment: 'live' | 'test';
  supported_currencies: Currency[];
  supported_payment_methods: PaymentMethodType[];
  location_restrictions?: string[]; // Location IDs
  stripe_config?: {
    publishable_key?: string;
    webhook_secret?: string;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// --- Invoice Configuration ---

export interface InvoiceSettings {
  id: string;
  location_id: string | null; // null = global
  numbering_format: {
    prefix: string;
    sequence: 'global' | 'per_location';
    next_number: number;
  };
  timing: {
    mode: InvoiceTimingMode;
    consolidation_day?: number; // 1-28 for monthly
  };
  due_terms: InvoiceDueTerm;
  default_language: 'en' | 'de' | 'fr' | 'it';
  footer_text?: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

// --- Tax Rules ---

export interface TaxRule {
  id: string;
  name: string;
  tax_type: 'VAT' | 'GST' | 'Sales_Tax';
  rate: number; // Percentage
  service_categories: ('daycare' | 'grooming' | 'boutique' | 'transport' | 'overnights')[];
  location_id: string | null; // null = applies to all
  effective_from: string;
  effective_until: string | null;
  vat_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// --- Fees & Penalties ---

export interface FeeDefinition {
  id: string;
  fee_type: 'late_pickup' | 'no_show' | 'late_cancellation' | 'transport_failure' | 'custom';
  name: string;
  description: string;
  calculation_method: 'fixed' | 'per_minute' | 'per_block' | 'percentage';
  amount: number;
  block_size_minutes?: number; // For per_block
  grace_period_minutes?: number;
  location_id: string | null; // null = global
  requires_approval_to_waive: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// --- Refunds & Credits ---

export interface RefundSettings {
  id: string;
  refund_methods: RefundMethod[];
  approval_threshold_chf: number; // Requires approval above this
  max_refund_amount_by_role: {
    admin: number;
    manager: number;
    assistant_manager: number;
  };
  credit_expiry_days: number | null; // null = no expiry
  credits_transferable: boolean;
  require_justification: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface RefundRecord {
  id: string;
  invoice_id: string;
  booking_id?: string;
  amount: number;
  currency: Currency;
  method: RefundMethod;
  reason: string;
  status: 'pending_approval' | 'approved' | 'completed' | 'rejected';
  requested_by: string;
  approved_by?: string;
  created_at: string;
  completed_at?: string;
}

export interface CreditRecord {
  id: string;
  household_id: string;
  amount: number;
  currency: Currency;
  reason: string;
  expires_at: string | null;
  remaining_balance: number;
  is_transferable: boolean;
  created_by: string;
  created_at: string;
}

// --- Membership Billing Rules ---

export interface MembershipBillingRules {
  id: string;
  billing_cycle: 'monthly_fixed' | 'rolling';
  billing_day?: number; // 1-28
  proration_enabled: boolean;
  proration_rules: {
    mid_cycle_join: 'full_month' | 'prorated' | 'next_cycle';
    pause_handling: 'continue_billing' | 'pause_billing' | 'prorate';
  };
  failed_payment_handling: {
    retry_schedule: number[]; // Days after failure
    grace_period_days: number;
    auto_suspend_after_days: number;
  };
  multi_dog_discount_enabled: boolean;
  multi_dog_discount_config?: {
    second_dog_discount_percent: number;
    third_plus_discount_percent: number;
  };
  created_at: string;
  updated_at: string;
  updated_by: string;
}

// --- Financial Permissions ---

export interface FinancialPermission {
  id: string;
  role: 'admin' | 'manager' | 'assistant_manager' | 'staff';
  can_view_financial_data: boolean;
  can_issue_refunds: boolean;
  can_apply_credits: boolean;
  can_waive_fees: boolean;
  can_export_reports: boolean;
  can_modify_invoices: boolean;
  max_refund_amount: number | null; // null = unlimited
  bypass_approvals: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

// --- Approval Rules ---

export interface ApprovalRule {
  id: string;
  action_type: 'refund' | 'credit' | 'fee_waiver' | 'invoice_adjustment' | 'manual_payment';
  threshold_amount: number;
  currency: Currency;
  requires_approval: boolean;
  approver_roles: ('admin' | 'manager')[];
  notification_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// --- Accounting & Exports ---

export interface ExportConfiguration {
  id: string;
  name: string;
  format: ExportFormat;
  schedule: ExportSchedule;
  scope: 'per_location' | 'organisation_wide';
  location_ids?: string[];
  include_data: {
    invoices: boolean;
    payments: boolean;
    refunds: boolean;
    credits: boolean;
    fees: boolean;
  };
  export_day?: number; // For scheduled exports
  email_recipients: string[];
  is_active: boolean;
  last_export_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface ExportRecord {
  id: string;
  configuration_id: string;
  export_date: string;
  file_url: string;
  row_count: number;
  generated_by: string;
  generated_at: string;
}

// --- Audit & Controls ---

export interface FinancialAuditLog {
  id: string;
  action_type: 'invoice_created' | 'invoice_edited' | 'payment_received' | 'refund_issued' | 'credit_applied' | 'fee_applied' | 'fee_waived' | 'settings_changed' | 'export_generated';
  entity_type: 'invoice' | 'payment' | 'refund' | 'credit' | 'fee' | 'settings' | 'export';
  entity_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  justification?: string;
  ip_address?: string;
  location_id?: string;
  created_at: string;
}

export interface AuditControls {
  id: string;
  invoice_soft_lock_enabled: boolean;
  invoice_lock_after_days: number;
  prevent_financial_record_deletion: boolean;
  require_justification_for_adjustments: boolean;
  enforce_sequential_invoice_numbering: boolean;
  alert_on_large_refunds: boolean;
  large_refund_threshold: number;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

// --- Statistics ---

export interface BillingFinanceStats {
  total_providers_enabled: number;
  total_tax_rules_active: number;
  total_fees_defined: number;
  pending_refund_approvals: number;
  total_credits_outstanding: number;
  export_configurations: number;
  audit_log_entries_last_30_days: number;
}
