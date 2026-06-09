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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasPermission: (module: string, action: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // If the user previously logged in without "Stay logged in", sign them out
      // on a new browsing session. Must be awaited before checking the session
      // to avoid a race where getSession() returns a stale token that signOut()
      // then immediately invalidates.
      const isTempSession = sessionStorage.getItem('mdc-temp-session');
      const hasStoredSession = localStorage.getItem('mdc-operations-auth');
      const sessionStart = sessionStorage.getItem('mdc-session-start');
      const tempLoginFlag = localStorage.getItem('mdc-temp-login-flag');

      if (!isTempSession && hasStoredSession && !sessionStart && tempLoginFlag === 'true') {
        localStorage.removeItem('mdc-temp-login-flag');
        await supabase.auth.signOut();
      }

      if (!sessionStorage.getItem('mdc-session-start')) {
        sessionStorage.setItem('mdc-session-start', new Date().toISOString());
      }

      if (cancelled) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        setUser(session?.user ? mapSupabaseUser(session.user) : null);
        setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setIsLoading(false);
      // Supabase AuthError properties are non-enumerable — normalise to a plain Error
      throw new Error(error.message || error.name || 'Authentication failed');
    }
  };

  const logout = async () => {
    // Clean up session flags
    sessionStorage.removeItem('mdc-temp-session');
    sessionStorage.removeItem('mdc-session-start');
    localStorage.removeItem('mdc-temp-login-flag');
    await supabase.auth.signOut();
    setUser(null);
  };

  const mapSupabaseUser = (sbUser: SupabaseUser): User => {
    const metadata = sbUser.user_metadata || {};
    // Role MUST come from app_metadata. user_metadata is client-writable, so
    // a malicious user could call supabase.auth.updateUser({ data: { role: 'admin' } })
    // and self-promote if we trusted user_metadata.role here. The server-side
    // requireAuth middleware also reads from app_metadata for the same reason.
    const role = (sbUser.app_metadata?.role as Role) || 'staff';
    return {
      id: sbUser.id,
      name: metadata.name || sbUser.email || 'Unknown',
      email: sbUser.email || '',
      role,
      locationIds: metadata.locationIds || ['loc-1'],
      templateId: metadata.templateId, // Permission template assignment
      permissions: metadata.permissions || [] // Per-user overrides
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
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasPermission }}>
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