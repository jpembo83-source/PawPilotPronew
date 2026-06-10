// Beta Features Hook
// Provides beta feature access control throughout the app
// Beta modules are visible to admins only, with "(beta)" suffix

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { isBetaTester, isBetaPath, isBetaModule, BETA_MODULES } from '../config/betaFeatures';

export function useBetaFeatures() {
  const { user } = useAuth();
  
  // Beta access is now admin-only (not based on email whitelist)
  const hasBetaAccess = useMemo(() => {
    return user?.role === 'admin';
  }, [user?.role]);
  
  // Legacy: check email-based beta tester status
  const isEmailBetaTester = useMemo(() => {
    return isBetaTester(user?.email);
  }, [user?.email]);
  
  // Check if a specific path should be visible
  const canAccessPath = (path: string): boolean => {
    if (!isBetaPath(path)) return true; // Not a beta path
    return hasBetaAccess; // Beta path - admin only
  };
  
  // Check if a module should be visible
  const canAccessModule = (moduleId: string): boolean => {
    if (!isBetaModule(moduleId)) return true; // Not a beta module
    return hasBetaAccess; // Beta module - admin only
  };
  
  // Filter nav items - admins see all, others don't see beta items
  const filterNavItems = <T extends { path: string; label?: string }>(items: T[]): T[] => {
    if (hasBetaAccess) {
      return items; // Admins see all items, no "(beta)" label clutter
    }
    return items.filter(item => !isBetaPath(item.path));
  };
  
  return {
    hasBetaAccess,
    isEmailBetaTester,
    canAccessPath,
    canAccessModule,
    filterNavItems,
    betaModules: BETA_MODULES,
  };
}

export default useBetaFeatures;
