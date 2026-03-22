// Policies Module Exports
// Staff Policy Portal - Production-grade policy compliance system
// Legally defensible, auditable, and suitable for real employment use

// Pages
export { MyPoliciesPage } from './pages/MyPoliciesPage';
export { PoliciesManagementPage } from './pages/PoliciesManagementPage';
export { PolicyPortal } from './pages/PolicyPortal';

// Components
export { UploadPolicyModal, AssignPolicyModal } from './components/PolicyModals';
export { 
  BlockingPolicyWarning, 
  BlockingPolicyBadge, 
  BlockingPolicyWidget 
} from './components/BlockingPolicyWarning';

// Hooks
export { 
  usePolicyCompliance, 
  useComplianceStats,
  useCanBeScheduled 
} from './hooks/usePolicyCompliance';

// Store
export { usePoliciesStore } from './store';

// Utilities
export { 
  exportAcknowledgements, 
  exportComplianceSummary, 
  exportAuditTrail 
} from './utils/exportCompliance';

// Types (re-export from staff module for convenience)
export type { 
  Policy,
  PolicyVersion,
  PolicyAssignment,
  PolicyAcknowledgement,
  AssignedPolicyView,
  PolicyCategory,
  PolicyStatus,
  AcknowledgementStatus,
  AcknowledgementType,
  RepeatCycleType,
  ReminderSchedule,
  ComplianceStats,
  PolicyComplianceReport,
  StaffComplianceSummary,
  PolicyAuditLog,
  AuditAction,
} from '../staff/types';

// Constants
export { 
  POLICY_CATEGORY_LABELS,
  REPEAT_CYCLE_LABELS,
  REPEAT_CYCLE_DAYS,
  DEFAULT_REMINDER_SCHEDULE,
} from '../staff/types';
