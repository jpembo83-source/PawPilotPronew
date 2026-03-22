// Beta Route Wrapper
// Protects beta-only routes from non-beta users

import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { isBetaTester } from '../config/betaFeatures';

interface BetaRouteProps {
  children: React.ReactNode;
  fallback?: string; // Where to redirect non-beta users (default: /)
}

export function BetaRoute({ children, fallback = '/' }: BetaRouteProps) {
  const { user } = useAuth();
  
  const hasBetaAccess = isBetaTester(user?.email);
  
  if (!hasBetaAccess) {
    // Redirect non-beta users to fallback
    return <Navigate to={fallback} replace />;
  }
  
  return <>{children}</>;
}

export default BetaRoute;
