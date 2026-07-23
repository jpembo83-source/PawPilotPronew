import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

export type Role = 'admin' | 'manager' | 'assistant_manager' | 'staff';

export interface Permission {
  module: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'export' | 'approve';
  flags?: string[]; // Optional flags like 'personal_data', 'financial_data'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationIds: string[];
  templateId?: string; // Link to permission template
  permissions?: Permission[]; // Per-user permission overrides
}

interface AuthContextType {
  user: User | null;
  /** Tenant the session operates within. Sourced from app_metadata only
   * (server-set). Pages like BulkImport/Export send it as X-Tenant-Id. */
  activeTenantId: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasPermission: (module: string, action: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if this is a temporary session that should be cleared
    const checkTemporarySession = async () => {
      const isTempSession = sessionStorage.getItem('mdc-temp-session');
      const hasLocalStorage = localStorage.getItem('mdc-operations-auth');
      
      // If temp session flag exists OR no remember-me was set, logout on new window
      if (!isTempSession && hasLocalStorage) {
        // This is a new window/tab and user didn't check "remember me"
        // Check if session was created within this browsing session
        const sessionStart = sessionStorage.getItem('mdc-session-start');
        if (!sessionStart) {
          // New browsing session, logout if it was a temp login
          const tempLoginFlag = localStorage.getItem('mdc-temp-login-flag');
          if (tempLoginFlag === 'true') {
            await supabase.auth.signOut();
            localStorage.removeItem('mdc-temp-login-flag');
            return;
          }
        }
      }
      
      // Mark that this session has started
      if (!sessionStorage.getItem('mdc-session-start')) {
        sessionStorage.setItem('mdc-session-start', new Date().toISOString());
      }
    };
    
    checkTemporarySession();
    
    let initialSessionResolved = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialSessionResolved) {
        initialSessionResolved = true;
        applySession(session?.user ?? null);
      }
    }).catch(() => {
      if (!initialSessionResolved) {
        initialSessionResolved = true;
        setUser(null);
        setActiveTenantId(null);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      initialSessionResolved = true;
      applySession(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    setIsLoading(true);
    
    // Set flags based on remember me choice
    if (!rememberMe) {
      // Store flags to indicate this is a temporary session
      sessionStorage.setItem('mdc-temp-session', 'true');
      localStorage.setItem('mdc-temp-login-flag', 'true');
    } else {
      // Remove the temp flags for persistent sessions
      sessionStorage.removeItem('mdc-temp-session');
      localStorage.removeItem('mdc-temp-login-flag');
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setIsLoading(false);
      throw error;
    }
    // Customer portal accounts must never get a staff session — sign the
    // session straight back out and tell the user which app to use. The
    // server rejects their tokens with 401 anyway (resolveStaffRole); this
    // makes the staff login fail fast with a clear message instead.
    if (data.user && staffRoleOf(data.user) === null) {
      await supabase.auth.signOut();
      setIsLoading(false);
      throw new Error(
        'This is a customer account. Staff sign-in is for employees only — please use the customer portal instead.'
      );
    }
  };

  const logout = async () => {
    // Clean up session flags
    sessionStorage.removeItem('mdc-temp-session');
    sessionStorage.removeItem('mdc-session-start');
    localStorage.removeItem('mdc-temp-login-flag');
    await supabase.auth.signOut();
    setUser(null);
        setActiveTenantId(null);
  };

  // Security-bearing fields read app_metadata only (server-set).
  const tenantOf = (sbUser: SupabaseUser): string | null =>
    sbUser.app_metadata?.tenant_id ?? sbUser.app_metadata?.tenantId ?? null;

  // Mirror of the server's resolveStaffRole (_shared/auth.ts): staff access
  // requires a valid, server-set staff role. Customer portal accounts are
  // created without one, so they never get a staff session — a missing role
  // must NOT default to 'staff'; that fallback is what let customer logins
  // reach the employee dashboard. (portal_user alone is not a reject signal:
  // staff who also accepted a portal invite keep their real role.)
  const STAFF_ROLES = ['admin', 'manager', 'assistant_manager', 'staff'] as const;
  const staffRoleOf = (sbUser: SupabaseUser): Role | null => {
    const role = (sbUser.app_metadata || {}).role as unknown;
    return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role)
      ? (role as Role)
      : null;
  };

  // The single gate every session goes through (initial load + auth state
  // changes): staff accounts get a session, anything else is signed out.
  const applySession = (sbUser: SupabaseUser | null) => {
    if (sbUser && staffRoleOf(sbUser) !== null) {
      setUser(mapSupabaseUser(sbUser));
      setActiveTenantId(tenantOf(sbUser));
    } else {
      if (sbUser) void supabase.auth.signOut();
      setUser(null);
      setActiveTenantId(null);
    }
    setIsLoading(false);
  };

  const mapSupabaseUser = (sbUser: SupabaseUser): User => {
    const metadata = sbUser.user_metadata || {};
    const appMetadata = sbUser.app_metadata || {};
    // Role MUST come from app_metadata. user_metadata is client-writable, so
    // a malicious user could call supabase.auth.updateUser({ data: { role: 'admin' } })
    // and self-promote if we trusted user_metadata.role here. The server-side
    // requireAuth middleware also reads from app_metadata for the same reason.
    // Callers gate on staffRoleOf first (applySession / login), so a null
    // here is unreachable; the ! keeps the guard the single source of truth.
    const role = staffRoleOf(sbUser)!;
    return {
      id: sbUser.id,
      name: metadata.name || sbUser.email || 'Unknown',
      email: sbUser.email || '',
      role,
      // Security fields come from app_metadata only (server-set).
      locationIds: appMetadata.locationIds ?? ['loc-1'],
      templateId: appMetadata.templateId, // Permission template assignment
      permissions: appMetadata.permissions ?? [] // Per-user overrides
    };
  };

  /**
   * Basic permission check - for full template-aware checking, use usePermissions() hook
   * This method provides a quick check based on role + direct user permissions
   */
  const hasPermission = (module: string, action: string) => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    // Check direct user permissions first (overrides)
    if (user.permissions && user.permissions.length > 0) {
      const directPerm = user.permissions.find(
        p => p.module === module && p.action === action
      );
      if (directPerm) return true;
    }
    
    // Role-based defaults (simplified - use usePermissions for full template resolution)
    if (user.role === 'manager') {
      // Managers have broad operational access
      if (module === 'settings') {
        // Limited settings access
        return action === 'view';
      }
      return true;
    }
    
    if (user.role === 'assistant_manager') {
      // Similar to manager but no delete and limited settings
      if (module === 'settings') return false;
      if (action === 'delete') return false;
      return ['view', 'create', 'update'].includes(action);
    }
    
    if (user.role === 'staff') {
      // Staff have minimal access
      if (module === 'settings') return false;
      if (module === 'billing') return false;
      if (module === 'staff') return action === 'view';
      if (['delete', 'export', 'approve'].includes(action)) return false;
      return ['view', 'update'].includes(action);
    }
    
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, activeTenantId, login, logout, isLoading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}