// Staff Management Module - Types
// Comprehensive type definitions for staff management, policies, and rotas
// Production-grade, legally defensible policy compliance system

// ============================================================================
// PERMISSIONS
// ============================================================================

export type StaffPermission = 
  | 'staff:view'
  | 'staff:manage'
  | 'policies:view'
  | 'policies:manage'
  | 'policies:assign'
  | 'policies:acknowledge'
  | 'policies:export'
  | 'policies:audit'
  | 'rota:view'
  | 'rota:manage'
  | 'rota:publish';

// ============================================================================
// STAFF / TEAM MEMBERS
// ============================================================================

export type StaffStatus = 'active' | 'inactive' | 'on_leave';

export interface StaffMember {
  id: string;
  tenant_id: string;
  user_id: string; // Links to auth user
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role_key: string; // e.g. 'manager', 'groomer', 'daycare_assistant'
  location_ids: string[]; // Locations this staff member works at
  status: StaffStatus;
  hire_date?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffProfile extends StaffMember {
  assigned_policies_count: number;
  overdue_policies_count: number;
  blocking_policies_count: number;
  upcoming_shifts_count: number;
  compliance_rate: number; // 0-100
  has_blocking_overdue: boolean; // Critical flag for operational blocking
}

// ============================================================================
// POLICIES
// ============================================================================

export type PolicyCategory = 
  | 'health_safety'
  | 'company_handbook'
  | 'daycare_sop'
  | 'grooming_sop'
  | 'transport_sop'
  | 'overnight_sop'
  | 'hr_policy'
  | 'disciplinary'
  | 'data_protection'
  | 'regulatory'
  | 'other';

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  health_safety: 'Health & Safety',
  company_handbook: 'Company Handbook',
  daycare_sop: 'Daycare SOP',
  grooming_sop: 'Grooming SOP',
  transport_sop: 'Transport SOP',
  overnight_sop: 'Overnight SOP',
  hr_policy: 'HR Policy',
  disciplinary: 'Disciplinary Procedures',
  data_protection: 'Data Protection',
  regulatory: 'Regulatory & Legal',
  other: 'Other',
};

export type PolicyStatus = 'draft' | 'published' | 'archived';

export interface Policy {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  category: PolicyCategory;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  status: PolicyStatus;
  published_at?: string;
  archived_at?: string;
  requires_reacknowledgement: boolean; // Auto-reassign when new version published
  latest_version?: PolicyVersion;
  versions_count: number;
  versions?: PolicyVersion[];
}

export interface PolicyVersion {
  id: string;
  tenant_id: string;
  policy_id: string;
  version_number: number;
  file_path: string;
  file_name: string;
  file_size?: number;
  file_type?: 'pdf' | 'doc' | 'docx';
  effective_date: string;
  expiry_date?: string; // Review date
  change_summary?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  is_current: boolean;
}

// ============================================================================
// POLICY ASSIGNMENTS
// ============================================================================

export type AssignmentScopeType = 
  | 'user'           // Specific user(s)
  | 'role'           // All users with this role
  | 'location'       // All users at this location
  | 'role_location'  // All users with this role at this location
  | 'organisation';  // All staff in organisation

export type AcknowledgementType = 
  | 'simple'         // Checkbox only
  | 'typed_name'     // Must type full name
  | 'blocking';      // Blocks operational access until acknowledged

// Repeat cycle configuration for periodic re-acknowledgement
export type RepeatCycleType = 
  | 'none'           // One-time only
  | 'annual'         // Every 12 months
  | 'biannual'       // Every 6 months
  | 'quarterly'      // Every 3 months
  | 'monthly'        // Every month
  | 'on_update'      // When policy version changes
  | 'on_role_change'; // When staff role/location changes

export const REPEAT_CYCLE_LABELS: Record<RepeatCycleType, string> = {
  none: 'One-time only',
  annual: 'Annual (every 12 months)',
  biannual: 'Bi-annual (every 6 months)',
  quarterly: 'Quarterly (every 3 months)',
  monthly: 'Monthly',
  on_update: 'On policy update (new version)',
  on_role_change: 'On role/location change',
};

export const REPEAT_CYCLE_DAYS: Record<RepeatCycleType, number> = {
  none: 0,
  annual: 365,
  biannual: 182,
  quarterly: 91,
  monthly: 30,
  on_update: 0, // Triggered by events, not time
  on_role_change: 0, // Triggered by events, not time
};

export interface ReminderSchedule {
  days_before: number[];           // e.g., [14, 7, 3, 1] - send reminders X days before due
  overdue_reminder: boolean;       // Continue reminding after overdue
  overdue_interval_days?: number;  // Days between overdue reminders (default 3)
}

export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  days_before: [7, 3, 1],
  overdue_reminder: true,
  overdue_interval_days: 3,
};

export interface PolicyAssignment {
  id: string;
  tenant_id: string;
  policy_version_id: string;
  policy_id: string;
  policy_title?: string;
  policy_category?: PolicyCategory;
  policy_version_number?: number;
  assigned_by: string;
  assigned_by_name?: string;
  scope_type: AssignmentScopeType;
  due_date: string;
  acknowledgement_type: AcknowledgementType;
  reminder_schedule: ReminderSchedule;
  manager_note?: string;
  created_at: string;
  updated_at: string;
  
  // Repeat cycle configuration
  repeat_cycle: RepeatCycleType;
  grace_period_days: number;        // Days after expiry before becoming overdue
  is_blocking: boolean;             // Blocks operational access when overdue
  
  // Expiry tracking (for repeat cycles)
  acknowledgement_expires_at?: string;
  last_acknowledged_at?: string;
  next_due_date?: string;           // Auto-calculated for repeat cycles
  
  // Populated from targets
  targets?: PolicyAssignmentTarget[];
  
  // Stats (populated on fetch)
  total_assignees?: number;
  acknowledged_count?: number;
  overdue_count?: number;
  completion_rate?: number;
}

export interface PolicyAssignmentTarget {
  id: string;
  tenant_id: string;
  assignment_id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  role_key?: string;
  location_id?: string;
  status: AcknowledgementStatus;
  acknowledged_at?: string;
  viewed_at?: string;
}

// ============================================================================
// POLICY ACKNOWLEDGEMENTS
// ============================================================================

export type AcknowledgementStatus = 
  | 'not_started'    // Not yet viewed
  | 'viewed'         // Document opened but not acknowledged
  | 'acknowledged'   // Confirmed read and understood
  | 'overdue'        // Past due date without acknowledgement
  | 'expired';       // Previous acknowledgement has expired (repeat cycle)

export interface PolicyAcknowledgement {
  id: string;
  tenant_id: string;
  policy_version_id: string;
  policy_id: string;
  assignment_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  acknowledged_at: string;  // Immutable timestamp
  viewed_at?: string;
  acknowledgement_text: string; // "I confirm I have read and understood this policy"
  typed_name?: string;      // If acknowledgement_type requires it
  metadata: {
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
  };
  // Audit fields - IMMUTABLE after creation
  created_at: string;
  expires_at?: string;      // When repeat cycle applies
}

// Staff view of assigned policies
export interface AssignedPolicyView {
  id: string;                       // Assignment target ID
  assignment_id: string;
  policy_id: string;
  policy_title: string;
  policy_category: PolicyCategory;
  policy_description?: string;
  version_id: string;
  policy_version: number;
  file_path: string;
  file_name: string;
  file_type?: string;
  due_date: string;
  assigned_at: string;
  assigned_by: string;
  assigned_by_name: string;
  manager_note?: string;
  status: AcknowledgementStatus;
  viewed_at: string | null;
  acknowledged_at: string | null;
  acknowledgement?: PolicyAcknowledgement;
  is_blocking: boolean;
  days_until_due: number;
  repeat_cycle: RepeatCycleType;
  previous_acknowledgement_date?: string;
}

// ============================================================================
// COMPLIANCE & AUDIT
// ============================================================================

export interface ComplianceStats {
  total_policies: number;
  total_assignments: number;
  acknowledged: number;
  pending: number;
  viewed: number;
  overdue: number;
  due_soon: number;              // Within 7 days
  blocking_overdue: number;      // Critical - affecting operations
  completion_rate: number;       // Percentage
}

export interface PolicyComplianceReport {
  policy_id: string;
  policy_title: string;
  policy_category: PolicyCategory;
  policy_version: number;
  assignment_id: string;
  total_assignees: number;
  acknowledged_count: number;
  pending_count: number;
  overdue_count: number;
  completion_rate: number;
  is_blocking: boolean;
  assignees: PolicyAssignmentTarget[];
}

export interface StaffComplianceSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  role_key: string;
  location_ids: string[];
  total_policies: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  blocking_overdue: number;
  compliance_rate: number;
  can_be_scheduled: boolean;    // false if blocking policies overdue
}

// Audit log for legal defensibility
export type AuditAction = 
  | 'policy_created'
  | 'policy_published'
  | 'policy_archived'
  | 'version_uploaded'
  | 'assignment_created'
  | 'assignment_updated'
  | 'policy_viewed'
  | 'policy_downloaded'
  | 'policy_acknowledged'
  | 'reminder_sent'
  | 'escalation_triggered'
  | 'compliance_exported'
  | 'blocking_enforced';

export interface PolicyAuditLog {
  id: string;
  tenant_id: string;
  action: AuditAction;
  entity_type: 'policy' | 'version' | 'assignment' | 'acknowledgement';
  entity_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  details: Record<string, any>;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

// ============================================================================
// ROTAS / SCHEDULING
// ============================================================================

export type RotaStatus = 'draft' | 'published';

export interface RotaPeriod {
  id: string;
  tenant_id: string;
  location_id: string;
  location_name?: string;
  start_date: string;
  end_date: string;
  status: RotaStatus;
  created_by: string;
  created_by_name?: string;
  published_by?: string;
  published_by_name?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  shifts?: RotaShift[];
  shifts_count?: number;
  staff_count?: number;
}

export interface RotaShift {
  id: string;
  tenant_id: string;
  rota_period_id: string;
  user_id: string;
  user_name?: string;
  location_id: string;
  role_key: string;
  role_name?: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  duration_hours?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Policy compliance check
  staff_has_blocking_overdue?: boolean;
  blocking_policy_count?: number;
}

export interface RotaWeekView {
  period_id: string;
  location_id: string;
  start_date: string;
  end_date: string;
  days: RotaDayView[];
}

export interface RotaDayView {
  date: string;
  day_name: string;
  shifts: RotaShift[];
}

// ============================================================================
// FILTERS & VIEWS
// ============================================================================

export interface StaffFilters {
  search?: string;
  role?: string;
  location_id?: string;
  status?: StaffStatus;
  has_overdue_policies?: boolean;
}

export interface PolicyFilters {
  search?: string;
  category?: PolicyCategory;
  status?: PolicyStatus;
}

export interface AssignmentFilters {
  policy_id?: string;
  policy_version_id?: string;
  status?: 'all' | 'pending' | 'overdue' | 'completed' | 'blocking';
  user_id?: string;
  location_id?: string;
  role_key?: string;
  is_blocking?: boolean;
}

export interface RotaFilters {
  location_id?: string;
  start_date?: string;
  end_date?: string;
  user_id?: string;
}

// ============================================================================
// FORMS & REQUESTS
// ============================================================================

export interface CreatePolicyRequest {
  title: string;
  description?: string;
  category?: string | PolicyCategory;
  requires_reacknowledgement?: boolean;
}

export interface UploadPolicyVersionRequest {
  policy_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  effective_date: string;
  expiry_date?: string;
  change_summary?: string;
}

export interface AssignPolicyRequest {
  policy_version_id: string;
  policy_id: string;  // Required - must reference a valid policy
  scope_type: AssignmentScopeType;
  targets: {
    user_ids?: string[];
    role_keys?: string[];
    location_ids?: string[];
  };
  due_date: string;
  acknowledgement_type?: AcknowledgementType;
  is_blocking?: boolean;
  reminder_schedule?: ReminderSchedule;
  manager_note?: string;
  repeat_cycle?: RepeatCycleType;
  grace_period_days?: number;
}

export interface AcknowledgePolicyRequest {
  assignment_id: string;
  policy_id: string;
  policy_version_id: string;
  typed_name?: string;
}

export interface CreateRotaPeriodRequest {
  location_id: string;
  start_date: string;
  end_date: string;
}

export interface CreateRotaShiftRequest {
  rota_period_id: string;
  user_id: string;
  location_id: string;
  role_key: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface UpdateRotaShiftRequest {
  user_id?: string;
  role_key?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
}

// ============================================================================
// EXPORT FORMATS
// ============================================================================

export interface AcknowledgementExportRow {
  policy_title: string;
  policy_version: number;
  policy_category: string;
  staff_name: string;
  staff_email: string;
  staff_role: string;
  assignment_date: string;
  due_date: string;
  viewed_at: string | null;
  acknowledged_at: string | null;
  typed_name: string | null;
  status: string;
  is_blocking: boolean;
  ip_address?: string;
}

export interface ComplianceExportRow {
  policy_title: string;
  policy_version: number;
  total_assigned: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  completion_rate: string;
  is_blocking: boolean;
}
