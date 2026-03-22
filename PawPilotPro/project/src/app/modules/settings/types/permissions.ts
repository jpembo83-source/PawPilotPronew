// ============================================================================
// SETTINGS RBAC - PERMISSION DEFINITIONS
// ============================================================================
// This defines the comprehensive permission model for Settings menu access
// according to the governance model where:
// - Admins own system integrity, compliance, financial risk, platform-wide behaviour
// - Managers own people, locations, pricing, day-to-day operations
// - Managers must never break compliance, alter financial rules, or affect stability

export type SettingsSection = 
  | 'organisation'
  | 'modules'
  | 'locations'
  | 'users'
  | 'services'
  | 'operations'
  | 'communications'
  | 'billing'
  | 'compliance'
  | 'integrations'
  | 'dashboard'
  | 'system';

export type SettingsAction = 
  | 'view'      // Can view the section
  | 'view_all'  // Can view all items (e.g., all locations vs assigned only)
  | 'create'    // Can create new items
  | 'update'    // Can update items
  | 'delete'    // Can delete items
  | 'configure' // Can configure settings
  | 'assign';   // Can assign permissions/roles

export interface SettingsPermission {
  section: SettingsSection;
  action: SettingsAction;
  scope?: 'all' | 'assigned' | 'operational'; // Scope qualifier
}

// ============================================================================
// ROLE-BASED ACCESS MATRIX
// ============================================================================

export interface SettingsSectionAccess {
  section: SettingsSection;
  label: string;
  description: string;
  
  // Access levels
  admin: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canCreate: boolean;
    scope: 'all';
  };
  
  manager: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canCreate: boolean;
    scope: 'all' | 'assigned' | 'operational' | 'none';
    restrictions?: string[]; // List of specific restrictions
  };
  
  assistantManager: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canCreate: boolean;
    scope: 'all' | 'assigned' | 'none';
    restrictions?: string[];
  };
  
  staff: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canCreate: boolean;
    scope: 'none';
  };
  
  // Additional metadata
  requiresAudit: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// ACCESS CONTROL DEFINITIONS
// ============================================================================

export const SETTINGS_ACCESS_CONTROL: Record<SettingsSection, SettingsSectionAccess> = {
  organisation: {
    section: 'organisation',
    label: 'Organisation',
    description: 'Legal entity, brand, global defaults',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: false,
      scope: 'all',
    },
    manager: {
      canView: true, // Optional read-only
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
      restrictions: ['Organisation settings are structural and legal, not operational'],
    },
    assistantManager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'critical',
  },
  
  modules: {
    section: 'modules',
    label: 'Modules',
    description: 'Enable/disable platform modules',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: false,
      scope: 'all',
    },
    manager: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: false,
      scope: 'assigned',
      restrictions: [
        'Can only enable/disable modules per assigned location',
        'Cannot enable modules not already globally enabled by Admin',
      ],
    },
    assistantManager: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'assigned',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'high',
  },
  
  locations: {
    section: 'locations',
    label: 'Locations',
    description: 'Manage branches and capacity',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: false,
      scope: 'assigned',
      restrictions: [
        'Can only edit assigned locations',
        'Can edit: opening hours, capacity, contact details',
        'Cannot edit: legal fields, tax fields, location deletion',
      ],
    },
    assistantManager: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'assigned',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'high',
  },
  
  users: {
    section: 'users',
    label: 'Users & Access',
    description: 'Staff accounts and roles',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'assigned',
      restrictions: [
        'Can only create/edit Staff and Assistant Manager users',
        'Cannot create Admin users',
        'Cannot edit system roles or permission templates',
        'Can only manage users for assigned locations',
      ],
    },
    assistantManager: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'assigned',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'critical',
  },
  
  services: {
    section: 'services',
    label: 'Services & Pricing',
    description: 'Service catalogue and price books',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'all',
      restrictions: [
        'Pricing is an operational responsibility owned by Managers',
        'Can bypass approvals as explicitly allowed',
      ],
    },
    assistantManager: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: true,
      scope: 'all',
      restrictions: ['Can submit pricing changes for approval only'],
    },
    staff: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'high',
  },
  
  operations: {
    section: 'operations',
    label: 'Operations Rules',
    description: 'Booking and check-in policies',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: true,
      scope: 'operational',
      restrictions: [
        'Can edit: capacity limits, booking cut-offs, pickup windows',
        'Cannot edit: compliance rules, billing enforcement, data protection',
      ],
    },
    assistantManager: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'operational',
    },
    staff: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'high',
  },
  
  communications: {
    section: 'communications',
    label: 'Communications',
    description: 'Templates and channels',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'operational',
      restrictions: [
        'Can create/edit message templates',
        'Can configure SLAs for assigned locations',
        'Can enable/disable approved automations',
        'Cannot configure channels, providers, consent rules',
      ],
    },
    assistantManager: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'operational',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'medium',
  },
  
  billing: {
    section: 'billing',
    label: 'Billing & Finance',
    description: 'Payment providers, tax, invoicing',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
      restrictions: [
        'Financial system configuration is Admin-only',
        'Billing operations handled in Billing module only',
      ],
    },
    assistantManager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'critical',
  },
  
  compliance: {
    section: 'compliance',
    label: 'Data & Compliance',
    description: 'Retention and GDPR',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: true, // Read-only optional
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
      restrictions: [
        'Compliance must remain centralised and tightly controlled',
        'Can initiate GDPR requests only if explicitly granted',
      ],
    },
    assistantManager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'critical',
  },
  
  integrations: {
    section: 'integrations',
    label: 'Integrations',
    description: 'API and webhooks',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
      restrictions: ['Integrations are high-risk and system-wide'],
    },
    assistantManager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'critical',
  },
  
  dashboard: {
    section: 'dashboard',
    label: 'Dashboard Config',
    description: 'Widget visibility and RBAC',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: false,
      scope: 'assigned',
      restrictions: [
        'Can configure dashboards for assigned locations',
        'Can control what staff see',
        'Cannot alter global defaults',
      ],
    },
    assistantManager: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'assigned',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'medium',
  },
  
  system: {
    section: 'system',
    label: 'System',
    description: 'Feature flags and maintenance',
    admin: {
      canView: true,
      canEdit: true,
      canDelete: false,
      canCreate: true,
      scope: 'all',
    },
    manager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
      restrictions: ['System settings are never delegated'],
    },
    assistantManager: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    staff: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      scope: 'none',
    },
    requiresAudit: true,
    riskLevel: 'critical',
  },
};

// ============================================================================
// OPERATIONAL RULES CATEGORIZATION
// For limiting Manager access to operational-only rules
// ============================================================================

export const OPERATIONAL_RULE_CATEGORIES = [
  'capacity',
  'booking-cutoffs',
  'pickup-windows',
  'operating-hours',
  'service-scheduling',
] as const;

export const COMPLIANCE_RULE_CATEGORIES = [
  'vaccination-requirements',
  'incident-reporting',
  'data-protection',
  'billing-enforcement',
  'document-requirements',
] as const;

export type OperationalRuleCategory = typeof OPERATIONAL_RULE_CATEGORIES[number];
export type ComplianceRuleCategory = typeof COMPLIANCE_RULE_CATEGORIES[number];

// ============================================================================
// LOCATION FIELD RESTRICTIONS
// For limiting Manager access to operational-only fields in locations
// ============================================================================

export const LOCATION_OPERATIONAL_FIELDS = [
  'name',
  'phone',
  'email',
  'timezone',
  'capacity',
  'enabledModules',
] as const;

export const LOCATION_RESTRICTED_FIELDS = [
  'legalName',
  'taxId',
  'registrationNumber',
  'address', // Legal address
] as const;

export type LocationOperationalField = typeof LOCATION_OPERATIONAL_FIELDS[number];
export type LocationRestrictedField = typeof LOCATION_RESTRICTED_FIELDS[number];
