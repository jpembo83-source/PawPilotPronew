import React from 'react';
import { useDashboardStore } from '../../dashboard/store';
import { WIDGETS } from '../../dashboard/constants';
import { Switch } from '../../../components/ui/switch';
import { useAuth } from '../../../context/AuthContext';
import { Shield, UsersThree, Lock } from '@phosphor-icons/react';
import { toast } from 'sonner';

export function DashboardSettings() {
  const { rolePermissions, updateRolePermissions } = useDashboardStore();
  const { user } = useAuth();

  const handleToggle = (role: string, widgetId: string) => {
    const current = rolePermissions[role] || [];
    const isAllowed = current.includes(widgetId);
    
    let newPermissions;
    if (isAllowed) {
      newPermissions = current.filter(id => id !== widgetId);
    } else {
      newPermissions = [...current, widgetId];
    }
    
    updateRolePermissions(role, newPermissions);
    toast.success(`Updated ${role} permissions`);
  };

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return <div className="p-8 text-center text-slate-500">You do not have permission to configure dashboard access.</div>;
  }

  // Admin configures Manager permissions
  // Manager configures Staff permissions
  const targetRole = user?.role === 'admin' ? 'manager' : 'staff';
  const myRole = user?.role || 'staff';
  
  // I can only grant what I have access to
  const myPermissions = rolePermissions[myRole] || [];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-lg font-medium text-slate-900">Dashboard Governance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Control which widgets are available to {targetRole}s.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 shadow-sm">
        {WIDGETS.map((widget) => {
          // Can only configure if I have access (or am admin/root)
          // Admin has implicit all access in our logic, but let's check store
          const iHaveAccess = user?.role === 'admin' || myPermissions.includes(widget.id);
          const isEnabledForTarget = (rolePermissions[targetRole] || []).includes(widget.id);

          if (!iHaveAccess) return null;

          return (
            <div key={widget.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${isEnabledForTarget ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                  <widget.icon className="h-5 w-5" />
                </div>
                <div>
                   <h3 className={`text-sm font-medium ${isEnabledForTarget ? 'text-slate-900' : 'text-slate-500'}`}>{widget.title}</h3>
                   <p className="text-xs text-slate-500">{widget.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{targetRole} Access</span>
                 <Switch 
                   checked={isEnabledForTarget}
                   onCheckedChange={() => handleToggle(targetRole, widget.id)}
                 />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-md p-4 flex gap-3 text-sm text-blue-800">
        <Shield className="h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <p className="font-medium">Governance Rules Applied</p>
          <ul className="list-disc list-inside mt-1 space-y-1 opacity-90">
             <li>{targetRole === 'manager' ? 'Managers' : 'Staff'} cannot enable widgets you have disabled.</li>
             <li>Changes apply immediately to all users with the {targetRole} role.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
