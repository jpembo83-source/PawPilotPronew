// Integrations Settings Types - MDC Operations Centre

export type IntegrationCategory = 'payment' | 'messaging' | 'accounting' | 'calendar' | 'identity' | 'internal_api';
export type IntegrationStatus = 'available' | 'coming_soon' | 'deprecated';
export type ConnectionStatus = 'active' | 'disabled' | 'error';
export type DataDirection = 'read' | 'write' | 'read_write';
export type DataCategory = 'customers' | 'pets' | 'bookings' | 'messages' | 'billing' | 'incidents';
export type CredentialType = 'api_key' | 'oauth_token' | 'webhook_secret';
export type SyncType = 'realtime' | 'scheduled';
export type SyncSchedule = 'hourly' | 'daily' | 'weekly' | 'manual';
export type ConflictHandling = 'platform_source_of_truth' | 'external_readonly';
export type HealthStatus = 'healthy' | 'degraded' | 'down';

// --- Integration Catalogue ---

export interface CatalogueEntry {
  id: string;
  name: string;
  provider: string;
  category: IntegrationCategory;
  description: string;
  supported_modules: string[];
  supported_directions: DataDirection[];
  required_permissions: string[];
  status: IntegrationStatus;
  logo_url?: string;
  documentation_url?: string;
  created_at: string;
}

// --- Connected Integrations ---

export interface ConnectedIntegration {
  id: string;
  catalogue_id: string;
  name: string;
  provider: string;
  category: IntegrationCategory;
  status: ConnectionStatus;
  scope: 'organisation' | 'location';
  location_ids?: string[];
  last_sync_at?: string;
  health_status: HealthStatus;
  error_message?: string;
  configuration: Record<string, unknown>;
  enabled_modules: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// --- Credentials & Secrets ---

export interface IntegrationCredential {
  id: string;
  integration_id: string;
  credential_type: CredentialType;
  credential_name: string;
  is_encrypted: boolean;
  expires_at?: string;
  last_rotated_at?: string;
  rotation_window_days?: number;
  location_id?: string; // For location-specific credentials
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

// --- Data Scope & Permissions ---

export interface DataScope {
  id: string;
  integration_id: string;
  data_categories: DataCategory[];
  direction: DataDirection;
  location_scope: 'all' | 'selected';
  location_ids?: string[];
  respects_user_permissions: boolean;
  respects_consent: boolean;
  respects_data_classification: boolean;
  field_level_restrictions?: Record<string, string[]>; // category -> allowed fields
  created_at: string;
  updated_at: string;
  updated_by: string;
}

// --- Webhooks & Events ---

export interface WebhookConfig {
  id: string;
  integration_id: string;
  endpoint_url: string;
  subscribed_events: string[];
  secret: string; // Hashed/encrypted
  retry_policy: {
    max_attempts: number;
    backoff_multiplier: number;
    initial_delay_seconds: number;
  };
  is_active: boolean;
  last_delivery_at?: string;
  last_delivery_status?: 'success' | 'failure';
  failure_count: number;
  created_at: string;
  updated_at: string;
}

// --- Synchronisation & Schedules ---

export interface SyncConfiguration {
  id: string;
  integration_id: string;
  sync_type: SyncType;
  schedule?: SyncSchedule;
  schedule_time?: string; // HH:MM for scheduled syncs
  conflict_handling: ConflictHandling;
  field_mappings?: Record<string, string>; // external_field -> platform_field
  is_idempotent: boolean;
  last_sync_at?: string;
  next_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncJob {
  id: string;
  integration_id: string;
  sync_config_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  started_at: string;
  completed_at?: string;
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  error_summary?: string;
  is_manual: boolean;
  triggered_by?: string;
}

// --- Health, Logs & Alerts ---

export interface IntegrationHealth {
  integration_id: string;
  status: HealthStatus;
  last_success_at?: string;
  last_failure_at?: string;
  error_rate_percent: number;
  avg_response_time_ms: number;
  uptime_percent_24h: number;
  checked_at: string;
}

export interface IntegrationLog {
  id: string;
  integration_id: string;
  log_type: 'request' | 'response' | 'error' | 'webhook' | 'sync';
  timestamp: string;
  method?: string;
  endpoint?: string;
  status_code?: number;
  error_message?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface IntegrationAlert {
  id: string;
  integration_id: string;
  alert_type: 'auth_failure' | 'sync_error' | 'webhook_failure' | 'rate_limit' | 'downtime';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  is_resolved: boolean;
  resolved_at?: string;
  notify_via_messaging: boolean;
  notification_sent: boolean;
  created_at: string;
}

// --- Audit & Controls ---

export interface IntegrationAuditLog {
  id: string;
  action_type: 'integration_created' | 'integration_updated' | 'integration_disabled' | 'credential_rotated' | 'scope_changed' | 'manual_sync' | 'webhook_configured';
  integration_id: string;
  integration_name: string;
  user_id: string;
  user_name: string;
  user_role: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  justification?: string;
  ip_address?: string;
  created_at: string;
}

// --- Statistics ---

export interface IntegrationsStats {
  total_integrations: number;
  active_integrations: number;
  integrations_with_errors: number;
  webhooks_configured: number;
  sync_jobs_last_24h: number;
  failed_sync_jobs_last_24h: number;
  unresolved_alerts: number;
  credential_expiring_soon: number;
}

// Available webhook events
export const WEBHOOK_EVENTS = [
  'booking.created',
  'booking.updated',
  'booking.cancelled',
  'daycare.check_in',
  'daycare.check_out',
  'grooming.completed',
  'transport.pickup',
  'transport.dropoff',
  'invoice.created',
  'invoice.paid',
  'message.sent',
  'customer.created',
  'customer.updated',
  'pet.created',
  'pet.updated',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
