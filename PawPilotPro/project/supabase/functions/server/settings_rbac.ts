// ============================================================================
// SETTINGS RBAC - SERVER-SIDE ENFORCEMENT
// ============================================================================
// This module provides server-side RBAC enforcement for Settings API routes
// CRITICAL: UI hiding is insufficient - all access must be enforced server-side

import { Context } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

// ============================================================================
// TYPES
// ============================================================================

export type Role = 'admin' | 'manager' | 'assistant_manager' | 'staff';

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

export interface UserContext {
  id: string;
  role: Role;
  locationIds: string[];
  email: string;
  name: string;
}

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

/**
 * Extract and validate user from request
 */
export async function getUserFromRequest(c: Context): Promise<UserContext | null> {
  try {
    // Extract JWT token from X-User-Token header (user JWT) or Authorization header (fallback)
    const userTokenHeader = c.req.header('X-User-Token');
    const authHeader = c.req.header('Authorization');
    
    // Prefer X-User-Token, fallback to Authorization
    const tokenSource = userTokenHeader || authHeader;
    
    if (!tokenSource) {
      console.log('[Auth] No token found in X-User-Token or Authorization headers');
      return null;
    }
    
    const token = tokenSource.replace('Bearer ', '').trim();
    
    if (!token) {
      console.log('[Auth] Empty token after Bearer extraction');
      return null;
    }
    
    // Verify token with Supabase
    // CRITICAL: JWT validation requires SERVICE_ROLE_KEY, not ANON key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // DEVELOPMENT MODE: If SERVICE_ROLE_KEY is not available, decode JWT payload without validation
    if (!supabaseServiceKey) {
      console.warn('[Auth] ⚠️ DEV MODE: No SERVICE_ROLE_KEY - decoding JWT without validation');
      
      try {
        // Decode JWT payload (without signature verification)
        const parts = token.split('.');
        
        if (parts.length !== 3) {
          console.error('[Auth] Invalid JWT format');
          return null;
        }
        
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        
        // Extract user info from JWT payload
        const userId = payload.sub;
        const email = payload.email;
        const userMetadata = payload.user_metadata || {};
        
        if (!userId || !email) {
          console.error('[Auth] JWT missing required fields');
          return null;
        }
        
        console.log('[Auth] ✓ Dev mode auth:', email);
        
        return {
          id: userId,
          role: (userMetadata.role as Role) || 'staff',
          locationIds: userMetadata.locationIds || [],
          email: email,
          name: userMetadata.name || email || 'Unknown',
        };
      } catch (decodeError) {
        console.error('[Auth] Failed to decode JWT:', decodeError instanceof Error ? decodeError.message : String(decodeError));
        return null;
      }
    }
    
    // PRODUCTION MODE: Validate JWT with Supabase with retry logic
    const url = supabaseUrl || 'https://ruahrxkfgfyshuxykiay.supabase.co';
    const key = supabaseServiceKey;
    
    // Retry logic for transient network errors
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const supabase = createClient(url, key);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error) {
          console.log('[Auth] Supabase auth error:', error.message);
          return null;
        }
        
        if (!user) {
          console.log('[Auth] No user returned');
          return null;
        }
        
        console.log('[Auth] ✓ Verified:', user.email);
        
        const metadata = user.user_metadata || {};
        
        return {
          id: user.id,
          role: (metadata.role as Role) || 'staff',
          locationIds: metadata.locationIds || [],
          email: user.email || '',
          name: metadata.name || user.email || 'Unknown',
        };
      } catch (networkError: any) {
        lastError = networkError;
        console.warn(`[Auth] Network error on attempt ${attempt + 1}/3:`, networkError.message);
        
        // If this is the last attempt, fall back to JWT decode
        if (attempt === 2) {
          console.warn('[Auth] All retry attempts failed, falling back to JWT decode');
          break;
        }
        
        // Wait before retry (exponential backoff: 100ms, 200ms)
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
    
    // Fallback: Decode JWT locally if network requests fail
    console.warn('[Auth] Falling back to local JWT decode due to network errors');
    try {
      const parts = token.split('.');
      
      if (parts.length !== 3) {
        console.error('[Auth] Invalid JWT format');
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      const userId = payload.sub;
      const email = payload.email;
      const userMetadata = payload.user_metadata || {};
      
      if (!userId || !email) {
        console.error('[Auth] JWT missing required fields');
        return null;
      }
      
      console.log('[Auth] ✓ Fallback auth:', email);
      
      return {
        id: userId,
        role: (userMetadata.role as Role) || 'staff',
        locationIds: userMetadata.locationIds || [],
        email: email,
        name: userMetadata.name || email || 'Unknown',
      };
    } catch (decodeError) {
      console.error('[Auth] Failed to decode JWT in fallback:', decodeError instanceof Error ? decodeError.message : String(decodeError));
      throw lastError; // Re-throw original network error
    }
  } catch (error) {
    console.error('[Auth] Unexpected error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(c: Context, next: () => Promise<void>) {
  console.log('[requireAuth] ==========================================');
  console.log('[requireAuth] Checking authentication...');
  console.log('[requireAuth] Request path:', c.req.path);
  console.log('[requireAuth] Request method:', c.req.method);
  console.log('[requireAuth] Headers:', {
    'X-User-Token': c.req.header('X-User-Token') ? 'present' : 'missing',
    'Authorization': c.req.header('Authorization') ? 'present' : 'missing'
  });
  
  const user = await getUserFromRequest(c);
  
  console.log('[requireAuth] getUserFromRequest returned:', user ? `User ${user.email} (${user.role})` : 'null');
  
  if (!user) {
    // Use debug instead of error - authentication failures are expected for unauthenticated requests
    console.debug('[requireAuth] Authentication failed - no user found');
    console.debug('[requireAuth] Returning 401 Unauthorized');
    return c.json({ 
      code: 401, 
      message: 'Invalid JWT',
      details: 'Authentication token is missing or invalid'
    }, 401);
  }
  
  console.log('[requireAuth] ✅ Auth successful for:', user.email, 'role:', user.role);
  
  // Store user in context for later use
  c.set('user', user);
  
  await next();
}

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
      console.warn(`Permission denied: ${user.email} (${user.role}) attempted to ${action} ${section}`);
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
    
    console.log(`[AUDIT] ${user.role} ${user.email} ${action} ${section}`, details);
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