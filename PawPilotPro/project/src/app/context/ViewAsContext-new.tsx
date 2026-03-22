// View As Context - MDC Operations Centre
// Provides View As functionality with Zustand-based state management

import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useViewAsStore } from '../stores/viewAsStore';
import * as viewAsApi from '../modules/view-as/api';
import type { ViewAsSession, ViewAsUser } from '../modules/view-as/types';

interface ViewAsContextType {
  isViewingAs: boolean;
  session: ViewAsSession | null;
  targetUser: ViewAsUser | null;
  startViewAs: (targetUserId: string, reason?: string) => Promise<void>;
  endViewAs: () => Promise<void>;
  validateAction: (actionType: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

const ViewAsContext = createContext<ViewAsContextType | undefined>(undefined);

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const store = useViewAsStore();

  // Load active session on mount (only once when user is available)
  useEffect(() => {
    let mounted = true;

    const loadActiveSession = async () => {
      // Don't load if auth is still loading or no user
      if (authLoading || !user?.id) {
        return;
      }

      try {
        const activeSession = await viewAsApi.getActiveSession(user.id);
        
        // Only update if component is still mounted
        if (mounted && activeSession) {
          store.setSession(activeSession);
          store.setTargetUser({
            id: activeSession.view_as_user_id,
            name: activeSession.view_as_user_name,
            email: '',
            role: activeSession.view_as_user_role,
            locations: [],
            permissions: [],
            enabled_modules: [],
          });
        }
      } catch (err) {
        // Silently ignore - no active session is normal
        if (mounted) {
          store.setError(null);
        }
      }
    };

    loadActiveSession();

    return () => {
      mounted = false;
    };
  }, [user?.id, authLoading]); // Only depend on user.id and authLoading

  const startViewAs = async (targetUserId: string, reason?: string) => {
    if (!user?.id) {
      store.setError('No authenticated user');
      throw new Error('No authenticated user');
    }

    store.setLoading(true);
    store.setError(null);

    try {
      const response = await viewAsApi.startViewAsSession(user.id, targetUserId, reason);
      store.setSession(response.session);
      store.setTargetUser(response.target_user);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start View As session';
      store.setError(errorMessage);
      throw err;
    } finally {
      store.setLoading(false);
    }
  };

  const endViewAs = async () => {
    if (!user?.id || !store.session?.id) {
      return;
    }

    store.setLoading(true);
    store.setError(null);

    try {
      await viewAsApi.endViewAsSession(user.id, store.session.id);
      store.reset();
      
      // Force a page reload to reset all state
      window.location.reload();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end View As session';
      store.setError(errorMessage);
      throw err;
    } finally {
      store.setLoading(false);
    }
  };

  const validateAction = async (actionType: string): Promise<boolean> => {
    if (!store.session?.id) {
      return true; // Not in view-as mode, allow all actions
    }

    try {
      const result = await viewAsApi.validateAction(store.session.id, actionType);
      if (!result.allowed && result.reason) {
        store.setError(result.reason);
      }
      return result.allowed;
    } catch (err) {
      console.error('Failed to validate action:', err);
      return false;
    }
  };

  const value: ViewAsContextType = {
    isViewingAs: !!store.session?.is_active,
    session: store.session,
    targetUser: store.targetUser,
    startViewAs,
    endViewAs,
    validateAction,
    isLoading: store.isLoading || authLoading,
    error: store.error,
  };

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (context === undefined) {
    throw new Error('useViewAs must be used within a ViewAsProvider');
  }
  return context;
}
