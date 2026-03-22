// System Menu Types - MDC Operations Centre

export type OrganisationStatus = 'active' | 'suspended' | 'trial' | 'archived';
export type ModuleName = 'daycare' | 'grooming' | 'boutique' | 'transport' | 'overnights' | 'compliance';
export type FeatureFlagScope = 'global' | 'organisation' | 'beta';
export type JobStatus = 'running' | 'completed' | 'failed' | 'paused';
export type HealthStatus = 'healthy' | 'degraded' | 'outage';
export type Environment = 'production' | 'staging' | 'development';

// --- System Overview ---

export interface SystemOverview {
  active_organisations: number;
  suspended_organisations: number;
  total_users: number;
  active_users_24h: number;
  enabled_modules: Record<ModuleName, number>; // count of orgs with module enabled
  integration_health: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
  };
  background_jobs: {
    running: number;
    paused: number;
    failed_last_24h: number;
  };
  recent_critical_events: number;
}

// --- Organisation Management ---

export interface Organisation {
  id: string;
  name: string;
  legal_name?: string;
  status: OrganisationStatus;
  created_at: string;
  suspended_at?: string;
  suspended_reason?: string;
  suspended_by?: string;
  trial_ends_at?: string;
  enabled_modules: ModuleName[];
  location_count: number;
  user_count: number;
  subscription_tier?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface OrganisationUsageMetrics {
  organisation_id: string;
  month: string;
  total_bookings: number;
  total_customers: number;
  total_pets: number;
  total_revenue: number;
  storage_used_mb: number;
  api_calls: number;
}

// --- Feature Flags & Modules ---

export interface FeatureFlag {
  id: string;
  flag_key: string;
  display_name: string;
  description: string;
  scope: FeatureFlagScope;
  is_enabled: boolean;
  affects_modules: ModuleName[];
  rollout_percentage?: number; // For gradual rollouts
  enabled_organisations?: string[]; // For org-specific flags
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface ModuleConfiguration {
  module_name: ModuleName;
  is_enabled_globally: boolean;
  requires_feature_flag?: string;
  default_enabled_for_new_orgs: boolean;
  organisations_enabled: number;
  created_at: string;
  updated_at: string;
}

// --- Global Defaults ---

export interface GlobalDefaults {
  id: string;
  category: 'modules' | 'pricing' | 'communications' | 'retention' | 'operational';
  setting_key: string;
  setting_value: unknown;
  display_name: string;
  description: string;
  can_organisations_override: boolean;
  applies_to_new_orgs_only: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

// --- Environment & Security ---

export interface EnvironmentSettings {
  environment: Environment;
  is_maintenance_mode: boolean;
  maintenance_message?: string;
  ip_allowlist?: string[];
  ip_denylist?: string[];
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  session_timeout_minutes: number;
  password_min_length: number;
  password_require_special_chars: boolean;
  password_require_numbers: boolean;
  password_require_uppercase: boolean;
  mfa_required_for_admins: boolean;
  updated_at: string;
  updated_by: string;
}

// --- Background Jobs ---

export interface BackgroundJob {
  id: string;
  job_name: string;
  job_type: 'retention' | 'export' | 'billing' | 'sync' | 'cleanup' | 'notification';
  schedule: string; // cron expression
  status: JobStatus;
  last_run_at?: string;
  last_run_duration_ms?: number;
  last_run_status?: 'success' | 'failure';
  last_run_error?: string;
  next_run_at?: string;
  is_critical: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobExecution {
  id: string;
  job_id: string;
  job_name: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed';
  records_processed: number;
  error_message?: string;
  triggered_by?: string; // manual execution
}

// --- System Health ---

export interface SystemHealthMetrics {
  timestamp: string;
  api_availability: HealthStatus;
  api_response_time_ms: number;
  database_health: HealthStatus;
  database_connection_pool: {
    active: number;
    idle: number;
    total: number;
  };
  integration_health: HealthStatus;
  active_integrations: number;
  failed_integrations: number;
  error_rate_percent: number;
  requests_per_minute: number;
}

// --- Logs & Diagnostics ---

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  category: 'auth' | 'api' | 'integration' | 'job' | 'security' | 'config';
  message: string;
  details?: Record<string, unknown>;
  user_id?: string;
  organisation_id?: string;
  ip_address?: string;
  stack_trace?: string;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  action_type: 'feature_flag_changed' | 'module_enabled' | 'organisation_suspended' | 'security_setting_changed' | 'job_executed' | 'emergency_action';
  entity_type: 'organisation' | 'feature_flag' | 'module' | 'setting' | 'job';
  entity_id: string;
  user_id: string;
  user_name: string;
  action_description: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  reason?: string;
  ip_address?: string;
}

// --- System Actions ---

export interface SystemAction {
  action_type: 'emergency_disable' | 'force_logout' | 'rotate_secrets' | 'enable_maintenance' | 'clear_cache';
  confirmation_required: boolean;
  requires_reason: boolean;
  requires_second_admin: boolean;
  is_reversible: boolean;
  estimated_impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemActionExecution {
  id: string;
  action_type: string;
  executed_by: string;
  executed_at: string;
  reason: string;
  approved_by?: string; // second admin
  result: 'success' | 'failure';
  affected_entities: number;
  duration_ms: number;
  is_reversed: boolean;
  reversed_at?: string;
}

// --- Filters ---

export interface LogFilters {
  level?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}
