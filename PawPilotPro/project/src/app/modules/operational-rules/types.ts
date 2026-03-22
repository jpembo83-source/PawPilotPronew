// Operational Rules Module Types - MDC Operations Centre

export type RuleModule = 'daycare' | 'grooming' | 'transport' | 'boutique' | 'incidents' | 'communications' | 'billing';

export type RuleScope = 'organisation' | 'location';

export type RuleCategory = 
  | 'booking_cancellation'
  | 'check_in_out'
  | 'grooming'
  | 'transport'
  | 'boutique'
  | 'incident_safety'
  | 'communications'
  | 'billing_fees';

export type RuleType = 
  | 'threshold'      // IF metric crosses threshold THEN action
  | 'time_window'    // IF action outside window THEN action
  | 'requirement'    // IF condition not met THEN block
  | 'limit'          // IF count exceeds limit THEN action
  | 'workflow';      // IF event THEN update status + notify

export type RuleOutcome = 'allow' | 'warn' | 'block' | 'escalate' | 'auto_update';

export type RuleStatus = 'draft' | 'active' | 'disabled';

// Event triggers
export type RuleEvent =
  // Booking events
  | 'booking.create'
  | 'booking.cancel'
  | 'booking.no_show'
  | 'booking.modify'
  // Daycare events
  | 'daycare.check_in'
  | 'daycare.check_out'
  | 'daycare.capacity_check'
  // Grooming events
  | 'grooming.appointment.create'
  | 'grooming.start'
  | 'grooming.complete'
  | 'grooming.late_arrival'
  // Transport events
  | 'transport.route.finalise'
  | 'transport.stop.complete'
  | 'transport.failed_pickup'
  | 'transport.capacity_check'
  // Boutique events
  | 'boutique.sale.create'
  | 'boutique.refund.request'
  | 'boutique.discount.apply'
  // Incident events
  | 'incident.create'
  | 'incident.escalate'
  | 'incident.close'
  // Communications events
  | 'message.inbound'
  | 'message.reply'
  | 'message.sla_breach'
  // Billing events
  | 'invoice.create'
  | 'payment.received'
  | 'refund.issued'
  | 'late_fee.calculate';

// Condition operators
export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in_list'
  | 'not_in_list'
  | 'is_expired'
  | 'expires_within'
  | 'is_empty'
  | 'is_not_empty';

// Rule condition
export interface RuleCondition {
  id: string;
  field: string;           // e.g., "vaccination.expiryDate", "bookingTime", "severity"
  operator: ConditionOperator;
  value: any;              // String, number, boolean, date, or array
  description?: string;    // Human-readable explanation
}

// Rule action/outcome
export interface RuleAction {
  id: string;
  type: RuleOutcome;
  
  // For warnings/blocks
  message?: string;
  requireAcknowledgement?: boolean;
  
  // For escalations
  notifyRoles?: string[];          // ['manager', 'admin']
  notifyUsers?: string[];          // Specific user IDs
  createTask?: boolean;
  createIncident?: boolean;
  incidentSeverity?: string;
  
  // For auto-updates
  updateField?: string;
  updateValue?: any;
  
  // For workflow
  statusChange?: string;
  
  metadata?: Record<string, any>;
}

// Main operational rule
export interface OperationalRule {
  id: string;
  
  // Identity
  name: string;
  description: string;
  module: RuleModule;
  category: RuleCategory;
  type: RuleType;
  
  // Scope
  scope: RuleScope;
  scopeId: string;              // 'ORG' for organisation, locationId for location
  scopeName: string;            // Organisation name or location name
  
  // Override settings (for org-level rules)
  allowLocationOverride: boolean;
  
  // Rule definition
  event: RuleEvent;
  conditions: RuleCondition[];
  actions: RuleAction[];
  
  // Conditional targeting
  customerTiers?: string[];      // ['vip', 'standard'] - empty = all
  serviceTypes?: string[];       // Service-specific rules
  
  // Status
  status: RuleStatus;
  isOverride: boolean;           // True if this is a location override
  overridesRuleId?: string;      // ID of org rule being overridden
  
  // Priority (for conflict resolution)
  priority: number;              // Higher = evaluated first
  
  // Metadata
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  
  // Audit trail
  disabledAt?: string;
  disabledBy?: string;
  disabledReason?: string;
  
  version: number;
}

// Rule evaluation context (passed when evaluating)
export interface RuleEvaluationContext {
  event: RuleEvent;
  module: RuleModule;
  locationId: string;
  userId?: string;
  
  // Event-specific data
  data: Record<string, any>;
  
  // Context data
  customer?: {
    id: string;
    tier?: string;
    householdId: string;
  };
  pet?: {
    id: string;
    vaccination?: {
      expiryDate: string;
      isExpired: boolean;
    };
    behaviourFlags?: string[];
    medicalFlags?: string[];
  };
  booking?: {
    id: string;
    serviceType: string;
    scheduledTime: string;
  };
  
  timestamp: string;
}

// Rule evaluation result
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  outcome: RuleOutcome;
  
  // Results
  allowed: boolean;
  blocked: boolean;
  warning?: {
    message: string;
    requiresAcknowledgement: boolean;
  };
  escalation?: {
    notifyRoles: string[];
    notifyUsers: string[];
    createTask: boolean;
    createIncident: boolean;
  };
  autoUpdate?: {
    field: string;
    value: any;
  };
  
  // Metadata
  evaluatedAt: string;
  conditions: {
    conditionId: string;
    field: string;
    result: boolean;
  }[];
}

// Batch evaluation result (multiple rules)
export interface RuleEvaluationResponse {
  allowed: boolean;
  blocked: boolean;
  blockReason?: string;
  warnings: {
    ruleId: string;
    ruleName: string;
    message: string;
    requiresAcknowledgement: boolean;
  }[];
  escalations: {
    ruleId: string;
    ruleName: string;
    notifyRoles: string[];
    notifyUsers: string[];
  }[];
  autoUpdates: {
    field: string;
    value: any;
  }[];
  
  // Individual results
  results: RuleEvaluationResult[];
  
  evaluatedAt: string;
}

// Rule change audit
export interface RuleAudit {
  id: string;
  ruleId: string;
  ruleName: string;
  
  action: 'created' | 'updated' | 'disabled' | 'enabled' | 'deleted';
  
  // Changes
  before?: Partial<OperationalRule>;
  after?: Partial<OperationalRule>;
  
  // Actor
  performedBy: string;
  performedByName: string;
  performedAt: string;
  
  // Context
  reason?: string;          // Required for disable/tighten
  scope: RuleScope;
  scopeId: string;
  
  metadata?: Record<string, any>;
}

// Rule template (predefined common rules)
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  module: RuleModule;
  type: RuleType;
  
  // Pre-configured values
  event: RuleEvent;
  conditionTemplates: Omit<RuleCondition, 'id'>[];
  actionTemplates: Omit<RuleAction, 'id'>[];
  
  // Customisation hints
  customisableFields: string[];
  isRecommended: boolean;
}

// Rule builder state (for UI)
export interface RuleBuilderState {
  step: number;
  module?: RuleModule;
  category?: RuleCategory;
  type?: RuleType;
  event?: RuleEvent;
  conditions: RuleCondition[];
  actions: RuleAction[];
  
  // Metadata
  name?: string;
  description?: string;
  scope?: RuleScope;
  scopeId?: string;
  allowLocationOverride?: boolean;
  priority?: number;
}

// Filters for rules list
export interface RulesFilters {
  module?: RuleModule;
  category?: RuleCategory;
  scope?: RuleScope;
  status?: RuleStatus;
  locationId?: string;
  search?: string;
}

// Location override configuration
export interface LocationOverrideConfig {
  locationId: string;
  locationName: string;
  organisationRuleId: string;
  isOverrideAllowed: boolean;
  hasOverride: boolean;
  overrideRuleId?: string;
}
