// ============================================================================
// SETTINGS RBAC - UTILITY FUNCTIONS
// ============================================================================
// Helper functions for checking permissions throughout the Settings module

import { 
  SettingsSection, 
  SettingsAction, 
  SETTINGS_ACCESS_CONTROL,
  SettingsSectionAccess,
  OPERATIONAL_RULE_CATEGORIES,
  COMPLIANCE_RULE_CATEGORIES,
  LOCATION_OPERATIONAL_FIELDS,
  LOCATION_RESTRICTED_FIELDS,
  OperationalRuleCategory,
  LocationOperationalField,
} from '../types/permissions';
import { Role } from '../../../context/AuthContext';

// ============================================================================
// PERMISSION CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if a user has permission to perform an action on a settings section
 */
export function hasSettingsPermission(
  userRole: Role,
  section: SettingsSection,
  action: SettingsAction,
  context?: {
    locationId?: string;
    userLocationIds?: string[];
    ruleCategory?: string;
    fieldName?: string;
  }
): boolean {
  const accessControl = SETTINGS_ACCESS_CONTROL[section];
  
  if (!accessControl) {
    console.warn(`No access control defined for section: ${section}`);
    return false;
  }
  
  // Get role-specific access
  let roleAccess;
  switch (userRole) {
    case 'admin':
      roleAccess = accessControl.admin;
      break;
    case 'manager':
      roleAccess = accessControl.manager;
      break;
    case 'assistant_manager':
      roleAccess = accessControl.assistantManager;
      break;
    case 'staff':
      roleAccess = accessControl.staff;
      break;
    default:
      return false;
  }
  
  // Check action permission
  switch (action) {
    case 'view':
    case 'view_all':
      if (!roleAccess.canView) return false;
      break;
    case 'create':
      if (!roleAccess.canCreate) return false;
      break;
    case 'update':
    case 'configure':
      if (!roleAccess.canEdit) return false;
      break;
    case 'delete':
      if (!roleAccess.canDelete) return false;
      break;
    default:
      return false;
  }
  
  // Check scope restrictions
  if (roleAccess.scope === 'none') return false;
  
  if (roleAccess.scope === 'assigned' && context?.locationId && context?.userLocationIds) {
    // Check if user has access to this specific location
    if (!context.userLocationIds.includes(context.locationId)) {
      return false;
    }
  }
  
  // Check operational scope for Operations Rules
  if (section === 'operations' && roleAccess.scope === 'operational' && context?.ruleCategory) {
    if (!isOperationalRuleCategory(context.ruleCategory)) {
      return false;
    }
  }
  
  // Check location field restrictions
  if (section === 'locations' && action === 'update' && context?.fieldName) {
    if (userRole === 'manager' && !canEditLocationField(context.fieldName)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all sections a user can view
 */
export function getAccessibleSections(userRole: Role): SettingsSection[] {
  const sections: SettingsSection[] = [];
  
  for (const [section, access] of Object.entries(SETTINGS_ACCESS_CONTROL)) {
    let roleAccess;
    switch (userRole) {
      case 'admin':
        roleAccess = access.admin;
        break;
      case 'manager':
        roleAccess = access.manager;
        break;
      case 'assistant_manager':
        roleAccess = access.assistantManager;
        break;
      case 'staff':
        roleAccess = access.staff;
        break;
      default:
        continue;
    }
    
    if (roleAccess.canView) {
      sections.push(section as SettingsSection);
    }
  }
  
  return sections;
}

/**
 * Get access info for a specific section
 */
export function getSectionAccess(
  section: SettingsSection,
  userRole: Role
): {
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  scope: string;
  restrictions: string[];
  riskLevel: string;
} {
  const accessControl = SETTINGS_ACCESS_CONTROL[section];
  
  if (!accessControl) {
    return {
      canView: false,
      canEdit: false,
      canCreate: false,
      canDelete: false,
      scope: 'none',
      restrictions: [],
      riskLevel: 'high',
    };
  }
  
  let roleAccess;
  switch (userRole) {
    case 'admin':
      roleAccess = accessControl.admin;
      break;
    case 'manager':
      roleAccess = accessControl.manager;
      break;
    case 'assistant_manager':
      roleAccess = accessControl.assistantManager;
      break;
    case 'staff':
      roleAccess = accessControl.staff;
      break;
    default:
      return {
        canView: false,
        canEdit: false,
        canCreate: false,
        canDelete: false,
        scope: 'none',
        restrictions: [],
        riskLevel: 'high',
      };
  }
  
  return {
    canView: roleAccess.canView,
    canEdit: roleAccess.canEdit,
    canCreate: roleAccess.canCreate,
    canDelete: roleAccess.canDelete,
    scope: roleAccess.scope,
    restrictions: roleAccess.restrictions || [],
    riskLevel: accessControl.riskLevel,
  };
}

/**
 * Check if a rule category is operational (vs compliance)
 */
export function isOperationalRuleCategory(category: string): boolean {
  return OPERATIONAL_RULE_CATEGORIES.includes(category as OperationalRuleCategory);
}

/**
 * Check if a rule category is compliance-related
 */
export function isComplianceRuleCategory(category: string): boolean {
  return COMPLIANCE_RULE_CATEGORIES.includes(category as any);
}

/**
 * Check if a Manager can edit a specific location field
 */
export function canEditLocationField(fieldName: string): boolean {
  return LOCATION_OPERATIONAL_FIELDS.includes(fieldName as LocationOperationalField);
}

/**
 * Check if a field is restricted for Managers
 */
export function isRestrictedLocationField(fieldName: string): boolean {
  return LOCATION_RESTRICTED_FIELDS.includes(fieldName as any);
}

/**
 * Get user-friendly permission message
 */
export function getPermissionMessage(
  section: SettingsSection,
  action: SettingsAction,
  userRole: Role
): string {
  const hasPermission = hasSettingsPermission(userRole, section, action);
  
  if (hasPermission) {
    return `You have permission to ${action} ${section}`;
  }
  
  const accessControl = SETTINGS_ACCESS_CONTROL[section];
  const roleAccess = userRole === 'admin' 
    ? accessControl.admin 
    : userRole === 'manager' 
    ? accessControl.manager 
    : userRole === 'assistant_manager'
    ? accessControl.assistantManager
    : accessControl.staff;
  
  if (roleAccess.restrictions && roleAccess.restrictions.length > 0) {
    return roleAccess.restrictions[0];
  }
  
  return `Your role (${userRole}) does not have permission to ${action} ${section}`;
}

/**
 * Filter locations based on user access
 */
export function filterLocationsByAccess<T extends { id: string }>(
  locations: T[],
  userRole: Role,
  userLocationIds: string[]
): T[] {
  if (userRole === 'admin') {
    return locations; // Admins see all
  }
  
  if (userRole === 'manager' || userRole === 'assistant_manager') {
    return locations.filter(loc => userLocationIds.includes(loc.id));
  }
  
  return []; // Staff see none in settings
}

/**
 * Check if user can manage another user based on roles
 */
export function canManageUser(
  managerRole: Role,
  targetUserRole: Role
): boolean {
  if (managerRole === 'admin') {
    return true; // Admins can manage everyone
  }
  
  if (managerRole === 'manager') {
    // Managers can manage Staff and Assistant Managers only
    return targetUserRole === 'staff' || targetUserRole === 'assistant_manager';
  }
  
  return false; // Assistant Managers and Staff cannot manage users
}

/**
 * Check if user can create a specific role
 */
export function canCreateRole(
  creatorRole: Role,
  targetRole: Role
): boolean {
  if (creatorRole === 'admin') {
    return true; // Admins can create any role
  }
  
  if (creatorRole === 'manager') {
    // Managers can only create Staff and Assistant Manager roles
    return targetRole === 'staff' || targetRole === 'assistant_manager';
  }
  
  return false;
}

// ============================================================================
// AUDIT HELPERS
// ============================================================================

/**
 * Determine if an action requires audit logging
 */
export function requiresAudit(section: SettingsSection): boolean {
  const accessControl = SETTINGS_ACCESS_CONTROL[section];
  return accessControl?.requiresAudit ?? true; // Default to true for safety
}

/**
 * Get risk level for a section
 */
export function getRiskLevel(section: SettingsSection): string {
  const accessControl = SETTINGS_ACCESS_CONTROL[section];
  return accessControl?.riskLevel ?? 'high';
}

/**
 * Format audit log entry
 */
export function formatAuditEntry(
  section: SettingsSection,
  action: SettingsAction,
  userId: string,
  userName: string,
  details: Record<string, any>
): {
  section: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
  riskLevel: string;
} {
  return {
    section,
    action,
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details: JSON.stringify(details),
    riskLevel: getRiskLevel(section),
  };
}
