// ============================================================================
// PERMISSION GATE COMPONENT
// ============================================================================
// Universal permission guard for rendering content based on user permissions
// Uses the centralised usePermissions hook

import React from 'react';
import { usePermissions, PermissionAction } from '../hooks/usePermissions';
import { ShieldOff, Lock } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface PermissionGateProps {
  /** Module to check permission for */
  module: string;
  /** Action required (view, create, update, delete, export, approve) */
  action: PermissionAction;
  /** Content to render if permission granted */
  children: React.ReactNode;
  /** Optional fallback content if permission denied */
  fallback?: React.ReactNode;
  /** Show an access denied message instead of nothing */
  showDeniedMessage?: boolean;
  /** Custom denied message */
  deniedMessage?: string;
}

/**
 * Gate component that conditionally renders children based on permissions
 * 
 * @example
 * <PermissionGate module="billing" action="delete">
 *   <DeleteInvoiceButton />
 * </PermissionGate>
 * 
 * @example
 * <PermissionGate module="settings" action="update" showDeniedMessage>
 *   <SettingsForm />
 * </PermissionGate>
 */
export function PermissionGate({
  module,
  action,
  children,
  fallback,
  showDeniedMessage = false,
  deniedMessage,
}: PermissionGateProps) {
  const { hasPermission, userRole } = usePermissions();
  
  const isAllowed = hasPermission(module, action);
  
  if (isAllowed) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showDeniedMessage) {
    return (
      <Alert variant="default" className="border-amber-200 bg-amber-50">
        <ShieldOff className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          {deniedMessage || `You don't have permission to ${action} ${module}. Contact your administrator if you need access.`}
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
}

interface RequirePermissionProps {
  /** Array of required permissions (all must be satisfied) */
  require: Array<{ module: string; action: PermissionAction }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Require multiple permissions to render content
 * 
 * @example
 * <RequirePermission require={[
 *   { module: 'billing', action: 'view' },
 *   { module: 'invoices', action: 'create' }
 * ]}>
 *   <CreateInvoiceFromBilling />
 * </RequirePermission>
 */
export function RequirePermission({ require, children, fallback }: RequirePermissionProps) {
  const { hasAllPermissions } = usePermissions();
  
  if (hasAllPermissions(require)) {
    return <>{children}</>;
  }
  
  return fallback ? <>{fallback}</> : null;
}

interface ModuleGateProps {
  /** Module name to check access for */
  module: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showDeniedMessage?: boolean;
}

/**
 * Gate that checks if user has ANY access to a module
 * Useful for showing/hiding entire sections
 * 
 * @example
 * <ModuleGate module="billing">
 *   <BillingModule />
 * </ModuleGate>
 */
export function ModuleGate({ module, children, fallback, showDeniedMessage }: ModuleGateProps) {
  const { canAccessModule } = usePermissions();
  
  if (canAccessModule(module)) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showDeniedMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-slate-100 p-4 mb-4">
          <Lock className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Access Restricted</h3>
        <p className="text-slate-500 max-w-md">
          You don't have access to the {module} module. Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }
  
  return null;
}

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Shortcut for admin-only content
 */
export function AdminOnly({ children, fallback }: AdminOnlyProps) {
  const { isAdmin } = usePermissions();
  
  if (isAdmin) {
    return <>{children}</>;
  }
  
  return fallback ? <>{fallback}</> : null;
}

interface ManagerOrAboveProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Shortcut for manager or admin content
 */
export function ManagerOrAbove({ children, fallback }: ManagerOrAboveProps) {
  const { isAdmin, isManager } = usePermissions();
  
  if (isAdmin || isManager) {
    return <>{children}</>;
  }
  
  return fallback ? <>{fallback}</> : null;
}
