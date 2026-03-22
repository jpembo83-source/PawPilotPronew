// ============================================================================
// PERMISSION GUARD COMPONENT
// ============================================================================
// Wraps UI elements and conditionally renders based on permissions

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { hasSettingsPermission } from '../utils/rbac';
import { SettingsSection, SettingsAction } from '../types/permissions';
import { ShieldOff, Info } from 'lucide-react';
import { Alert, AlertDescription } from '../../../components/ui/alert';

interface PermissionGuardProps {
  section: SettingsSection;
  action: SettingsAction;
  context?: {
    locationId?: string;
    ruleCategory?: string;
    fieldName?: string;
  };
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

/**
 * Guard component that shows/hides content based on permissions
 */
export function PermissionGuard({
  section,
  action,
  context,
  children,
  fallback,
  showMessage = false,
}: PermissionGuardProps) {
  const { user } = useAuth();
  
  if (!user) {
    return fallback || null;
  }
  
  const hasPermission = hasSettingsPermission(
    user.role,
    section,
    action,
    {
      ...context,
      userLocationIds: user.locationIds,
    }
  );
  
  if (!hasPermission) {
    if (showMessage) {
      return (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <ShieldOff className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You don't have permission to {action} {section}. Contact your administrator if you need access.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback || null;
  }
  
  return <>{children}</>;
}

interface RestrictedFieldProps {
  fieldName: string;
  section: SettingsSection;
  children: React.ReactNode;
  readOnlyView?: React.ReactNode;
}

/**
 * Wrapper for form fields that may be restricted for certain roles
 */
export function RestrictedField({
  fieldName,
  section,
  children,
  readOnlyView,
}: RestrictedFieldProps) {
  const { user } = useAuth();
  
  if (!user) return null;
  
  const canEdit = hasSettingsPermission(
    user.role,
    section,
    'update',
    {
      fieldName,
      userLocationIds: user.locationIds,
    }
  );
  
  if (!canEdit && readOnlyView) {
    return <>{readOnlyView}</>;
  }
  
  if (!canEdit) {
    return null; // Hide completely if no read-only view
  }
  
  return <>{children}</>;
}

interface SectionAccessBadgeProps {
  section: SettingsSection;
  className?: string;
}

/**
 * Badge showing user's access level for a section
 */
export function SectionAccessBadge({ section, className }: SectionAccessBadgeProps) {
  const { user } = useAuth();
  
  if (!user) return null;
  
  const canView = hasSettingsPermission(user.role, section, 'view');
  const canEdit = hasSettingsPermission(user.role, section, 'update');
  const canCreate = hasSettingsPermission(user.role, section, 'create');
  
  if (!canView) return null;
  
  let accessLevel = 'View Only';
  let badgeColor = 'bg-slate-100 text-slate-700';
  
  if (canCreate && canEdit) {
    accessLevel = 'Full Access';
    badgeColor = 'bg-green-100 text-green-800';
  } else if (canEdit) {
    accessLevel = 'Edit Access';
    badgeColor = 'bg-blue-100 text-blue-800';
  }
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor} ${className}`}>
      <Info className="h-3 w-3" />
      {accessLevel}
    </span>
  );
}

interface PermissionInfoProps {
  section: SettingsSection;
}

/**
 * Shows information about user's permissions and restrictions
 */
export function PermissionInfo({ section }: PermissionInfoProps) {
  const { user } = useAuth();
  
  if (!user || user.role === 'admin') return null; // Admins don't need this
  
  const canView = hasSettingsPermission(user.role, section, 'view');
  
  if (!canView) return null;
  
  // Get restrictions from access control
  const accessControl = require('../types/permissions').SETTINGS_ACCESS_CONTROL[section];
  let roleAccess;
  
  switch (user.role) {
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
      return null;
  }
  
  if (!roleAccess.restrictions || roleAccess.restrictions.length === 0) {
    return null;
  }
  
  return (
    <Alert variant="default" className="border-blue-200 bg-blue-50 mb-4">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <p className="font-medium mb-2">Your Access Restrictions:</p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {roleAccess.restrictions.map((restriction: string, index: number) => (
            <li key={index}>{restriction}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
