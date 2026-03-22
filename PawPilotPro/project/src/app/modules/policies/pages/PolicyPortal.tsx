// Policy Portal - Unified Entry Point
// Automatically switches between Staff View and Manager View based on user role

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { MyPoliciesPage } from './MyPoliciesPage';
import { PoliciesManagementPage } from './PoliciesManagementPage';
import ErrorBoundary from '../../../components/ErrorBoundary';

export function PolicyPortal() {
  const { user } = useAuth();
  
  // Determine which view to show based on role
  const isManager = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager';
  
  return (
    <ErrorBoundary>
      {isManager ? <PoliciesManagementPage /> : <MyPoliciesPage />}
    </ErrorBoundary>
  );
}

export default PolicyPortal;
