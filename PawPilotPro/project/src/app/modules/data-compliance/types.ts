// Data & Compliance Module Types - MDC Operations Centre

export type RequestType = 'access' | 'rectification' | 'erasure' | 'restriction';
export type RequestSource = 'customer' | 'regulator' | 'internal';
export type RequestStatus = 'pending' | 'in_review' | 'in_progress' | 'completed' | 'rejected';
export type DataCategory = 'personal' | 'medical' | 'behavioural' | 'financial' | 'operational';
export type ExportFormat = 'csv' | 'pdf' | 'json';
export type ExportScope = 'household' | 'location' | 'organisation';
export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';
export type JobStatus = 'scheduled' | 'running' | 'completed' | 'failed';

// --- Data Subject Requests (GDPR) ---

export interface DataSubjectRequest {
  id: string;
  request_type: RequestType;
  request_source: RequestSource;
  status: RequestStatus;
  household_id: string;
  household_name: string;
  contact_id?: string;
  data_categories: DataCategory[];
  scope_description: string;
  legal_basis?: string;
  created_at: string;
  created_by: string;
  reviewed_at?: string;
  reviewed_by?: string;
  completed_at?: string;
  completed_by?: string;
  outcome_notes?: string;
  response_documents?: string[]; // URLs
  location_id?: string;
}

export interface RequestAction {
  id: string;
  request_id: string;
  action_type: 'review' | 'export' | 'anonymise' | 'restrict' | 'reject' | 'complete';
  action_description: string;
  performed_by: string;
  performed_at: string;
  affected_records?: number;
  notes?: string;
}

// --- Data Exports ---

export interface DataExport {
  id: string;
  export_type: 'customer' | 'pet' | 'operational' | 'financial' | 'audit';
  scope: ExportScope;
  format: ExportFormat;
  scope_id?: string; // household_id, location_id, or null for org
  scope_description: string;
  data_categories: DataCategory[];
  file_url?: string;
  file_password?: string;
  file_size_bytes?: number;
  expires_at?: string;
  downloaded_at?: string;
  downloaded_by?: string;
  status: 'generating' | 'ready' | 'expired' | 'downloaded';
  created_by: string;
  created_at: string;
  location_id?: string;
}

// --- Access Logs ---

export interface DataAccessLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  access_type: 'view' | 'edit' | 'export' | 'delete';
  data_category: DataCategory;
  entity_type: 'household' | 'contact' | 'pet' | 'booking' | 'invoice' | 'note';
  entity_id: string;
  entity_description: string;
  module: string;
  reason?: string;
  ip_address?: string;
  location_id?: string;
  accessed_at: string;
}

// --- Retention & Deletion Jobs ---

export interface RetentionJob {
  id: string;
  job_name: string;
  job_type: 'anonymisation' | 'deletion' | 'archival';
  data_categories: DataCategory[];
  retention_period_days: number;
  next_run_at: string;
  last_run_at?: string;
  last_run_status?: JobStatus;
  last_run_records_affected?: number;
  last_run_error?: string;
  is_active: boolean;
  location_id?: string; // null = all locations
  created_at: string;
  updated_at: string;
}

export interface JobExecution {
  id: string;
  job_id: string;
  status: JobStatus;
  started_at: string;
  completed_at?: string;
  records_affected: number;
  records_failed: number;
  error_message?: string;
  execution_log?: string;
}

// --- Incidents & Breaches ---

export interface BreachRecord {
  id: string;
  title: string;
  description: string;
  severity: BreachSeverity;
  data_categories: DataCategory[];
  affected_locations: string[];
  affected_households?: string[];
  estimated_affected_count?: number;
  discovery_date: string;
  notification_required: boolean;
  notification_date?: string;
  regulator_notified: boolean;
  regulator_notification_date?: string;
  mitigation_actions: string;
  status: 'open' | 'under_investigation' | 'resolved' | 'closed';
  reported_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  incident_id?: string; // Link to incident module
}

// --- Compliance Audit Log ---

export interface ComplianceAuditLog {
  id: string;
  action_type: 'data_request' | 'export' | 'retention_action' | 'access_event' | 'breach_reported' | 'settings_changed';
  entity_type: 'request' | 'export' | 'job' | 'breach' | 'settings' | 'access_log';
  entity_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action_description: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ip_address?: string;
  location_id?: string;
  created_at: string;
}

// --- Dashboard Statistics ---

export interface ComplianceStats {
  open_requests_by_type: {
    access: number;
    rectification: number;
    erasure: number;
    restriction: number;
  };
  recent_exports_count: number;
  sensitive_access_events_7_days: number;
  sensitive_access_events_30_days: number;
  upcoming_retention_jobs: number;
  failed_retention_jobs: number;
  open_breaches: number;
  last_settings_change?: string;
}

// --- Filters ---

export interface AccessLogFilters {
  user_id?: string;
  data_category?: DataCategory;
  location_id?: string;
  date_from?: string;
  date_to?: string;
  entity_type?: string;
}

export interface AuditLogFilters {
  action_type?: string;
  user_id?: string;
  location_id?: string;
  date_from?: string;
  date_to?: string;
  entity_type?: string;
}
