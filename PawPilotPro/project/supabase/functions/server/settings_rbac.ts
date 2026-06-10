// ============================================================================
// SETTINGS RBAC - SERVER-SIDE ENFORCEMENT
// ============================================================================
// Permission rules + audit logging for the Settings surface. Authentication
// itself lives in _shared/auth.ts (the shared requireAuth middleware). This
// module re-exports the auth primitives for back-compat with existing imports.
// CRITICAL: UI hiding is insufficient - all access must be enforced server-side

import { Context } from "npm:hono";
import * as kv from "./kv_store.tsx";
import {
  requireAuth as sharedRequireAuth,
  validateUserToken,
  type AuthenticatedUser,
  type Role,
} from "./_shared/auth.ts";

// Re-export the auth primitives so consumers that import from settings_rbac.ts
// continue to work. The actual implementation now lives in _shared/auth.ts
// (SERVICE_ROLE_KEY validation, app_metadata role, zero fallbacks).
export type { Role };
export const requireAuth = sharedRequireAuth;

// UserContext is the legacy alias. AuthenticatedUser has the same shape, so any
// `c.get('user') as UserContext` access stays type-safe.
export type UserContext = AuthenticatedUser;

// ============================================================================
// TYPES
// ============================================================================

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
  | 'view'
  | 'view_all'
  | 'create'
  | 'update'
  | 'delete'
  | 'configure';

export interface PermissionContext {
  locationId?: string;
  ruleCategory?: string;
  fieldName?: string;
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

const OPERATIONAL_RULE_CATEGORIES = [
  'capacity',
  'booking-cutoffs',
  'pickup-windows',
  'operating-hours',
  'service-scheduling',
];

const LOCATION_OPERATIONAL_FIELDS = [
  'name',
  'phone',
  'email',
  'timezone',
  'capacity',
  'enabledModules',
];

/**
 * Check if user has permission for a settings action
 */
export function hasPermission(
  userRole: Role,
  section: SettingsSection,
  action: SettingsAction,
  context?: PermissionContext & { userLocationIds?: string[] }
): boolean {
  // Admin always has full access
  if (userRole === 'admin') {
    return true;
  }
  
  // Section-specific permissions
  switch (section) {
    case 'organisation':
      return userRole === 'admin' || (userRole === 'manager' && action === 'view');
    
    case 'modules':
      if (action === 'view') return userRole === 'admin' || userRole === 'manager' || userRole === 'assistant_manager';
      if (action === 'update' || action === 'configure') return userRole === 'admin' || userRole === 'manager';
      return false;
    
    case 'locations':
      if (action === 'view') return userRole === 'admin' || userRole === 'manager' || userRole === 'assistant_manager';
      if (action === 'create' || action === 'delete') return userRole === 'admin';
      if (action === 'update') {
        if (userRole === 'admin') return true;
        if (userRole === 'manager') {
          // Check location access
          if (context?.locationId && context?.userLocationIds) {
            if (!context.userLocationIds.includes(context.locationId)) return false;
          }
          // Check field restrictions
          if (context?.fieldName) {
            return LOCATION_OPERATIONAL_FIELDS.includes(context.fieldName);
          }
          return true;
        }
      }
      return false;
    
    case 'users':
      if (action === 'view') return userRole === 'admin' || userRole === 'manager' || userRole === 'assistant_manager';
      if (action === 'create' || action === 'update' || action === 'delete') {
        return userRole === 'admin' || userRole === 'manager';
      }
      return false;
    
    case 'services':
      if (action === 'view') return true; // All can view
      if (action === 'create' || action === 'update' || action === 'delete') {
        return userRole === 'admin' || userRole === 'manager' || userRole === 'assistant_manager';
      }
      return false;
    
    case 'operations':
      if (action === 'view') return true; // All can view
      if (action === 'create' || action === 'update') {
        if (userRole === 'admin') return true;
        if (userRole === 'manager') {
          // Only operational rules
          if (context?.ruleCategory) {
            return OPERATIONAL_RULE_CATEGORIES.includes(context.ruleCategory);
          }
          return false;
        }
      }
      if (action === 'delete') return userRole === 'admin';
      return false;
    
    case 'communications':
      if (action === 'view') return userRole === 'admin' || userRole === 'manager' || userRole === 'assistant_manager';
      if (action === 'create' || action === 'update' || action === 'delete') {
        return userRole === 'admin' || userRole === 'manager';
      }
      return false;
    
    case 'billing':
      return userRole === 'admin'; // Admin only
    
    case 'compliance':
      if (action === 'view') return userRole === 'admin' || userRole === 'manager';
      return userRole === 'admin';
    
    case 'integrations':
      return userRole === 'admin'; // Admin only
    
    case 'dashboard':
      if (action === 'view') return userRole === 'admin' || userRole === 'manager' || userRole === 'assistant_manager';
      if (action === 'update' || action === 'configure') return userRole === 'admin' || userRole === 'manager';
      return false;
    
    case 'system':
      return userRole === 'admin'; // Admin only
    
    default:
      return false;
  }
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================================
//
// The auth primitives (`requireAuth`, `getUserFromRequest`) are thin wrappers
// over the shared implementation in _shared/auth.ts. That implementation:
//   - validates tokens server-side with SERVICE_ROLE_KEY + supabase.auth.getUser
//   - reads role exclusively from app_metadata (server-set, not client-writable)
//   - has zero fallbacks — no local Base64 decode, no dev-mode bypass, no retry
//     loop that ends in a decode-only path, no ANON_KEY degradation.
// `requireAuth` is re-exported at the top of this file.

/**
 * Validate the request's user and return their profile, or null on failure.
 * Delegates to the shared validator (no fallbacks, no user_metadata role read).
 */
export const getUserFromRequest = validateUserToken;

/**
 * Middleware to require specific permission
 */
export function requirePermission(
  section: SettingsSection,
  action: SettingsAction
) {
  return async (c: Context, next: () => Promise<void>) => {
    const user = c.get('user') as UserContext;
    
    if (!user) {
      return c.json({ code: 401, message: 'Invalid JWT' }, 401);
    }
    
    // Get context from request (e.g., locationId from params)
    // Note: We don't read the body here to avoid consuming it before the route handler
    const locationId = c.req.param('locationId') || c.req.param('id');
    
    // For now, do a basic permission check without body context
    // Route handlers can do more granular checks if needed
    const permissionContext: PermissionContext & { userLocationIds?: string[] } = {
      locationId,
      userLocationIds: user.locationIds,
    };
    
    const hasAccess = hasPermission(user.role, section, action, permissionContext);
    
    if (!hasAccess) {
      console.warn(`Permission denied: user ${user.id} (${user.role}) attempted to ${action} ${section}`);
      return c.json({ 
        error: 'Forbidden', 
        message: `You do not have permission to ${action} ${section}` 
      }, 403);
    }
    
    await next();
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role;
  section: SettingsSection;
  action: SettingsAction;
  resourceId?: string;
  details: Record<string, any>;
  before?: any;
  after?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log settings change to audit log
 */
export async function logAudit(
  user: UserContext,
  section: SettingsSection,
  action: SettingsAction,
  details: {
    resourceId?: string;
    before?: any;
    after?: any;
    metadata?: Record<string, any>;
  },
  c?: Context
): Promise<void> {
  try {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      section,
      action,
      resourceId: details.resourceId,
      details: details.metadata || {},
      before: details.before,
      after: details.after,
      ipAddress: c?.req.header('x-forwarded-for') || c?.req.header('x-real-ip'),
      userAgent: c?.req.header('user-agent'),
    };
    
    // Store in KV
    const auditKey = `audit:settings:${entry.timestamp}:${entry.id}`;
    await kv.set(auditKey, entry);
    
    console.log(`[AUDIT] ${user.role} ${user.id} ${action} ${section}`, { resourceId: details.resourceId });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't fail the request if audit logging fails
  }
}

/**
 * Get audit logs for a section
 */
export async function getAuditLogs(
  section?: SettingsSection,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  try {
    const prefix = section ? `audit:settings:${section}:` : 'audit:settings:';
    const entries = await kv.getByPrefix(prefix);
    
    // Sort by timestamp descending
    const sorted = entries.sort((a: AuditLogEntry, b: AuditLogEntry) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return sorted.slice(0, limit);
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}