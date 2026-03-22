import React, { useState, useEffect } from 'react';
import { UserList } from '../components/users/UserList';
import { TemplateManager } from '../components/users/TemplateManager';
import { AccessAudit } from '../components/users/AccessAudit';
import { Button } from '../../../components/ui/button';
import { Users, Shield, History, Eye } from 'lucide-react';
import { useSettingsStore } from '../store';
import { ViewAsManagement } from '../../../modules/view-as/ViewAsManagement';
import { useAuth } from '../../../context/AuthContext';

type Tab = 'users' | 'templates' | 'audit' | 'view-as';

export function UserManagement() {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const { fetchLocations } = useSettingsStore();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Fetch locations when component mounts to populate location selection in UserDialog - only when authenticated
  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchLocations();
    }
  }, [fetchLocations, isAuthLoading, user]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-semibold text-slate-900">Users & Access Control</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage system users, roles, and granular permission templates across your organisation.
        </p>
      </div>

      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'users' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'templates' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="h-4 w-4" />
          Roles & Templates
        </button>
        <button
          onClick={() => setActiveTab('view-as')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'view-as' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Eye className="h-4 w-4" />
          View As
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'audit' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="h-4 w-4" />
          Audit Log
        </button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'users' && <UserList />}
        {activeTab === 'templates' && <TemplateManager />}
        {activeTab === 'view-as' && <ViewAsManagement />}
        {activeTab === 'audit' && <AccessAudit />}
      </div>
    </div>
  );
}