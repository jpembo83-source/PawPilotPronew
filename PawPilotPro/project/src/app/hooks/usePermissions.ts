// ============================================================================
// CENTRALISED PERMISSION HOOK
// ============================================================================
// Single source of truth for permission checking throughout the application
// Resolves permissions from: user overrides > template > role defaults

import { useEffect, useMemo } from 'react';
import { useAuth, Role, Permission } from '../context/AuthContext';
import { useUserStore } from '../modules/settings/stores/userStore';

// Module-level permission actions
export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'export' | 'approve';

// All modules in the system that can have permissions
export const PERMISSION_MODULES = [
  'dashboard',
  'capacity',    // Capacity management (separate from dashboard)
  'calendar',
  'customers',
  'daycare',
  'grooming',
  'transport',
  'overnights',  // Overnight boarding
  'boutique',
  'billing',
  'invoices',
  'payments',
  'incidents',
  'documents',
  'messages',
  'settings',
  'reports',
  'staff',
  'memberships',
  'packages',
] as const;

export type PermissionModule = typeof PERMISSION_MODULES[number];

// Role-based default permissions - fallback when no template assigned
// NOTE: These are ONLY used if user has NO templateId assigned
const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  admin: PERMISSION_MODULES.flatMap(module => 
    (['view', 'create', 'update', 'delete', 'export', 'approve'] as PermissionAction[]).map(action => ({
      module,
      action
    }))
  ),
  manager: [
    // Full access to operational modules
    ...['daycare', 'grooming', 'transport', 'overnights', 'customers', 'calendar', 'dashboard', 'capacity', 'messages', 'incidents', 'documents', 'staff'].flatMap(module =>
      (['view', 'create', 'update', 'delete'] as PermissionAction[]).map(action => ({ module, action }))
    ),
    // Limited finance access
    { module: 'billing', action: 'view' },
    { module: 'billing', action: 'create' },
    { module: 'invoices', action: 'view' },
    { module: 'invoices', action: 'create' },
    { module: 'payments', action: 'view' },
    { module: 'payments', action: 'create' },
    // Reports - view and export
    { module: 'reports', action: 'view' },
    { module: 'reports', action: 'export' },
    // Settings - limited
    { module: 'settings', action: 'view' },
  ],
  assistant_manager: [
    // Operational modules - view and limited edit
    ...['daycare', 'grooming', 'transport', 'overnights', 'customers', 'calendar', 'dashboard', 'capacity'].flatMap(module =>
      (['view', 'create', 'update'] as PermissionAction[]).map(action => ({ module, action }))
    ),
    { module: 'messages', action: 'view' },
    { module: 'messages', action: 'create' },
    { module: 'incidents', action: 'view' },
    { module: 'incidents', action: 'create' },
    { module: 'documents', action: 'view' },
    // No staff management
    { module: 'staff', action: 'view' },
    // No billing/finance
    { module: 'invoices', action: 'view' },
  ],
  // Staff defaults - these are OVERRIDDEN by template if assigned
  staff: [
    { module: 'dashboard', action: 'view' },
  ],
};

interface PermissionResult {
  hasPermission: (module: string, action: PermissionAction) => boolean;
  hasAnyPermission: (module: string) => boolean;
  hasAllPermissions: (checks: Array<{ module: string; action: PermissionAction }>) => boolean;
  canAccessModule: (module: string) => boolean;
  getModulePermissions: (module: string) => PermissionAction[];
  allPermissions: Permission[];
  isAdmin: boolean;
  isManager: boolean;
  userRole: Role | null;
}

/**
 * Central hook for permission checking
 * Resolves permissions in order: user overrides > assigned template > role defaults
 */
export function usePermissions(): PermissionResult {
  const { user } = useAuth();
  const { templates, myTemplate, ensureMyTemplate } = useUserStore();

  // Templates are server-backed; every role can fetch its OWN assigned
  // template so enforcement works for staff too (who cannot list all
  // templates). Loaded once per session, cached in the store.
  useEffect(() => {
    if (user) void ensureMyTemplate();
  }, [user, ensureMyTemplate]);

  // Resolve effective permissions for the current user
  const effectivePermissions = useMemo((): Permission[] => {
    if (!user) return [];

    // Admin gets everything
    if (user.role === 'admin') {
      return ROLE_DEFAULT_PERMISSIONS.admin;
    }

    // Start with role defaults
    let permissions = [...(ROLE_DEFAULT_PERMISSIONS[user.role] || [])];

    // templateId comes from app_metadata (server-set) via AuthContext; the
    // template body comes from the server (full list for managers, or the
    // caller's own via /settings/my-permission-template for everyone else).
    const templateId = user.templateId;
    if (templateId) {
      const template =
        templates.find(t => t.id === templateId) ??
        (myTemplate?.id === templateId ? myTemplate : undefined);
      if (template) {
        // Template permissions REPLACE role defaults (more specific)
        permissions = [...template.permissions];
      }
    }

    // User-specific overrides ADD to template permissions
    if (user.permissions && user.permissions.length > 0) {
      // Merge, avoiding duplicates
      const existingKeys = new Set(permissions.map(p => `${p.module}:${p.action}`));
      for (const perm of user.permissions) {
        const key = `${perm.module}:${perm.action}`;
        if (!existingKeys.has(key)) {
          permissions.push(perm);
          existingKeys.add(key);
        }
      }
    }

    return permissions;
  }, [user, templates, myTemplate]);

  // Check if user has a specific permission
  const hasPermission = (module: string, action: PermissionAction): boolean => {
    if (!user) return false;
    
    // Admin bypass
    if (user.role === 'admin') return true;
    
    return effectivePermissions.some(
      p => p.module === module && p.action === action
    );
  };

  // Check if user has ANY permission on a module
  const hasAnyPermission = (module: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return effectivePermissions.some(p => p.module === module);
  };

  // Check if user has ALL specified permissions
  const hasAllPermissions = (checks: Array<{ module: string; action: PermissionAction }>): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return checks.every(check => hasPermission(check.module, check.action));
  };

  // Alias for hasAnyPermission - checks if user can access a module at all
  const canAccessModule = (module: string): boolean => {
    return hasAnyPermission(module);
  };

  // Get all permissions a user has for a specific module
  const getModulePermissions = (module: string): PermissionAction[] => {
    if (!user) return [];
    if (user.role === 'admin') return ['view', 'create', 'update', 'delete', 'export', 'approve'];
    
    return effectivePermissions
      .filter(p => p.module === module)
      .map(p => p.action);
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessModule,
    getModulePermissions,
    allPermissions: effectivePermissions,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    userRole: user?.role || null,
  };
}

/**
 * Hook for checking a single permission - useful for conditional rendering
 */
export function useHasPermission(module: string, action: PermissionAction): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(module, action);
}

/**
 * Hook for checking module access
 */
export function useCanAccessModule(module: string): boolean {
  const { canAccessModule } = usePermissions();
  return canAccessModule(module);
}
