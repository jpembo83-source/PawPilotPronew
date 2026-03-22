// ============================================================================
// RBAC DOCUMENTATION PAGE
// ============================================================================
// Shows the complete RBAC model and governance rules for Settings

import React from 'react';
import { Shield, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SETTINGS_ACCESS_CONTROL } from '../types/permissions';
import { useAuth } from '../../../context/AuthContext';
import { Alert, AlertDescription } from '../../../components/ui/alert';

export function RBACDocumentationPage() {
  const { user } = useAuth();
  
  if (!user) return null;

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      case 'assistant_manager': return 'Assistant Manager';
      case 'staff': return 'Staff';
      default: return role;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings RBAC Model</h2>
        <p className="text-slate-600 mt-2">
          Comprehensive Role-Based Access Control for Settings menu according to governance principles.
        </p>
      </div>

      {/* Core Principles */}
      <Alert variant="default" className="border-blue-200 bg-blue-50">
        <Info className="h-5 w-5 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <p className="font-semibold mb-2">Core Governance Principles:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Admins own:</strong> System integrity, compliance, financial risk, and platform-wide behaviour</li>
            <li><strong>Managers own:</strong> People, locations, pricing, and day-to-day operational execution</li>
            <li><strong>Managers must never:</strong> Break compliance, alter financial system rules, or affect system-wide stability</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Current User's Role */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-slate-900">Your Access Level</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Role:</span>
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
            {getRoleDisplay(user.role)}
          </span>
        </div>
        {user.locationIds && user.locationIds.length > 0 && user.role !== 'admin' && (
          <div className="mt-2 text-sm text-slate-600">
            <span>Assigned Locations: </span>
            <span className="font-medium">{user.locationIds.length}</span>
          </div>
        )}
      </div>

      {/* Access Control Matrix */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Settings Sections Access Matrix</h3>
        
        {Object.entries(SETTINGS_ACCESS_CONTROL).map(([key, access]) => {
          const userRoleAccess = user.role === 'admin' 
            ? access.admin
            : user.role === 'manager'
            ? access.manager
            : user.role === 'assistant_manager'
            ? access.assistantManager
            : access.staff;

          return (
            <div key={key} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900">{access.label}</h4>
                  <p className="text-sm text-slate-600 mt-1">{access.description}</p>
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getRiskColor(access.riskLevel)}`}>
                  {access.riskLevel.toUpperCase()}
                </span>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {/* Admin */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">ADMIN</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        {access.admin.canView ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.admin.canView ? 'text-slate-900' : 'text-slate-400'}>View</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.admin.canEdit ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.admin.canEdit ? 'text-slate-900' : 'text-slate-400'}>Edit</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.admin.canCreate ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.admin.canCreate ? 'text-slate-900' : 'text-slate-400'}>Create</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.admin.canDelete ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.admin.canDelete ? 'text-slate-900' : 'text-slate-400'}>Delete</span>
                      </div>
                    </div>
                  </div>

                  {/* Manager */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">MANAGER</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        {access.manager.canView ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.manager.canView ? 'text-slate-900' : 'text-slate-400'}>View</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.manager.canEdit ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.manager.canEdit ? 'text-slate-900' : 'text-slate-400'}>Edit</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.manager.canCreate ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.manager.canCreate ? 'text-slate-900' : 'text-slate-400'}>Create</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.manager.canDelete ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.manager.canDelete ? 'text-slate-900' : 'text-slate-400'}>Delete</span>
                      </div>
                      {access.manager.scope !== 'all' && (
                        <p className="text-xs text-amber-600 font-medium mt-1">
                          Scope: {access.manager.scope}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Assistant Manager */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">ASSISTANT MANAGER</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        {access.assistantManager.canView ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.assistantManager.canView ? 'text-slate-900' : 'text-slate-400'}>View</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.assistantManager.canEdit ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.assistantManager.canEdit ? 'text-slate-900' : 'text-slate-400'}>Edit</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.assistantManager.canCreate ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.assistantManager.canCreate ? 'text-slate-900' : 'text-slate-400'}>Create</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.assistantManager.canDelete ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.assistantManager.canDelete ? 'text-slate-900' : 'text-slate-400'}>Delete</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">STAFF</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        {access.staff.canView ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.staff.canView ? 'text-slate-900' : 'text-slate-400'}>View</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {access.staff.canEdit ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <span className="h-3 w-3 text-slate-300">-</span>
                        )}
                        <span className={access.staff.canEdit ? 'text-slate-900' : 'text-slate-400'}>Edit</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">No Settings Access</p>
                    </div>
                  </div>
                </div>

                {/* User's Specific Access */}
                {userRoleAccess.canView && (
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mt-4">
                    <p className="text-xs font-medium text-primary mb-2">
                      Your Access ({getRoleDisplay(user.role)}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {userRoleAccess.canView && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">View</span>
                      )}
                      {userRoleAccess.canEdit && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Edit</span>
                      )}
                      {userRoleAccess.canCreate && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">Create</span>
                      )}
                      {userRoleAccess.canDelete && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Delete</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Restrictions */}
                {userRoleAccess.restrictions && userRoleAccess.restrictions.length > 0 && (
                  <div className="mt-3">
                    <Alert variant="default" className="border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        <p className="text-xs font-medium mb-1">Restrictions:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          {userRoleAccess.restrictions.map((restriction, idx) => (
                            <li key={idx}>{restriction}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Requirements */}
      <Alert variant="default" className="border-slate-200 bg-slate-50">
        <Shield className="h-5 w-5 text-slate-600" />
        <AlertDescription className="text-slate-700">
          <p className="font-semibold mb-2">Enforcement Requirements:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>All access is enforced server-side with JWT verification</li>
            <li>UI hiding alone is insufficient - API routes validate permissions</li>
            <li>All changes to settings are audited with before/after snapshots</li>
            <li>Audit logs capture: who, what, when, and context</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
