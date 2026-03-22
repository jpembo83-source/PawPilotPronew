import React, { useState, useEffect } from 'react';
import { PermissionTemplate, useUserStore, Permission } from '../../stores/userStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Badge } from '../../../../components/ui/badge';
import { useAuth } from '../../../../context/AuthContext';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Info, Shield } from 'lucide-react';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: PermissionTemplate | null;
  onSave: (template: Partial<PermissionTemplate>) => void;
}

// All modules that can have permissions assigned
const MODULES = [
  'dashboard',
  'capacity',
  'calendar',
  'customers',
  'daycare',
  'grooming',
  'transport',
  'overnights',
  'boutique',
  'billing',
  'invoices',
  'payments',
  'incidents',
  'documents',
  'messages',
  'reports',
  'staff',
  'memberships',
  'packages',
  'settings'
];

// Module display names and descriptions
const MODULE_INFO: Record<string, { label: string; description: string }> = {
  dashboard: { label: 'Dashboard', description: 'Main overview and widgets' },
  capacity: { label: 'Capacity', description: 'Capacity management and limits' },
  calendar: { label: 'Calendar', description: 'Appointments and scheduling' },
  customers: { label: 'Customers', description: 'Customer and pet records' },
  daycare: { label: 'Daycare', description: 'Daycare bookings and check-in' },
  grooming: { label: 'Grooming', description: 'Grooming appointments' },
  transport: { label: 'Transport', description: 'Pick-up and delivery routes' },
  overnights: { label: 'Overnights', description: 'Overnight boarding' },
  boutique: { label: 'Boutique', description: 'Retail and product sales' },
  billing: { label: 'Billing', description: 'Invoicing and payments' },
  invoices: { label: 'Invoices', description: 'Invoice management' },
  payments: { label: 'Payments', description: 'Payment processing' },
  incidents: { label: 'Incidents', description: 'Incident reporting' },
  documents: { label: 'Documents', description: 'Document storage' },
  messages: { label: 'Messaging', description: 'Customer communications' },
  reports: { label: 'Reports', description: 'Analytics and reporting' },
  staff: { label: 'Staff', description: 'Staff management and scheduling' },
  memberships: { label: 'Memberships', description: 'Membership plans' },
  packages: { label: 'Packages', description: 'Service packages' },
  settings: { label: 'Settings', description: 'System configuration' },
};

const ACTIONS = ['view', 'create', 'update', 'delete', 'export', 'approve'] as const;

// Action display info
const ACTION_INFO: Record<string, { label: string; description: string }> = {
  view: { label: 'View', description: 'Can see records' },
  create: { label: 'Create', description: 'Can create new records' },
  update: { label: 'Edit', description: 'Can modify existing records' },
  delete: { label: 'Delete', description: 'Can remove records' },
  export: { label: 'Export', description: 'Can export data' },
  approve: { label: 'Approve', description: 'Can approve actions' },
};

export function TemplateDialog({ open, onOpenChange, template, onSave }: TemplateDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<PermissionTemplate>>({
    name: '',
    description: '',
    permissions: []
  });

  // Admins can edit all templates, including system ones
  const isAdmin = user?.role === 'admin';
  const isSystem = template?.isSystem;
  // Allow editing if admin OR if not a system template
  const canEdit = isAdmin || !isSystem;

  useEffect(() => {
    if (template) {
      setFormData(template);
    } else {
      setFormData({
        name: '',
        description: '',
        permissions: []
      });
    }
  }, [template, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  const togglePermission = (module: string, action: Permission['action']) => {
    if (!canEdit) return;
    
    const currentPermissions = formData.permissions || [];
    const exists = currentPermissions.some(p => p.module === module && p.action === action);

    if (exists) {
      setFormData({
        ...formData,
        permissions: currentPermissions.filter(p => !(p.module === module && p.action === action))
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...currentPermissions, { module, action }]
      });
    }
  };

  const toggleAllInModule = (module: string) => {
    if (!canEdit) return;
    
    const currentPermissions = formData.permissions || [];
    const moduleActions = currentPermissions.filter(p => p.module === module);
    const allSelected = moduleActions.length === ACTIONS.length;

    if (allSelected) {
      // Remove all for this module
      setFormData({
        ...formData,
        permissions: currentPermissions.filter(p => p.module !== module)
      });
    } else {
      // Add all for this module (removing existing to avoid dupes)
      const otherPermissions = currentPermissions.filter(p => p.module !== module);
      const newPermissions = ACTIONS.map(action => ({ module, action }));
      setFormData({
        ...formData,
        permissions: [...otherPermissions, ...newPermissions]
      });
    }
  };

  // Select/deselect all permissions
  const selectAll = () => {
    if (!canEdit) return;
    const allPermissions = MODULES.flatMap(module =>
      ACTIONS.map(action => ({ module, action }))
    );
    setFormData({ ...formData, permissions: allPermissions });
  };

  const clearAll = () => {
    if (!canEdit) return;
    setFormData({ ...formData, permissions: [] });
  };

  const permCount = formData.permissions?.length || 0;
  const totalPossible = MODULES.length * ACTIONS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {template ? (canEdit ? 'Edit Template' : 'View Template') : 'Create New Template'}
            {isSystem && (
              <Badge variant="secondary" className="ml-2">System Template</Badge>
            )}
            {isAdmin && (
              <Badge variant="default" className="ml-2 bg-green-600">Admin</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {canEdit 
              ? 'Configure granular access rights for users assigned to this template. Changes will affect all users with this template assigned.'
              : `You need Admin privileges to modify this template. (Current role: ${user?.role || 'unknown'})`}
          </DialogDescription>
        </DialogHeader>

        {isSystem && canEdit && (
          <Alert variant="default" className="border-amber-200 bg-amber-50">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>System Template:</strong> Changes to this template will affect all users currently assigned to it. 
              Consider creating a copy if you want to customise without affecting existing assignments.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Senior Handler"
                required
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this role is for..."
                disabled={!canEdit}
                className="resize-none"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-sm text-slate-700">Permissions Matrix</span>
                <span className="text-xs text-slate-500 ml-2">
                  ({permCount} of {totalPossible} permissions selected)
                </span>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                    Clear All
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-500 min-w-[180px]">Module</th>
                    {ACTIONS.map(action => (
                      <th key={action} className="text-center px-2 py-2 font-medium text-slate-500 min-w-[70px]" title={ACTION_INFO[action]?.description}>
                        {ACTION_INFO[action]?.label || action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODULES.map(module => {
                     const perms = formData.permissions || [];
                     const moduleCount = perms.filter(p => p.module === module).length;
                     const isAll = moduleCount === ACTIONS.length;
                     const isSome = moduleCount > 0 && moduleCount < ACTIONS.length;
                     const moduleInfo = MODULE_INFO[module] || { label: module, description: '' };

                     return (
                      <tr key={module} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                             <Checkbox 
                               checked={isAll ? true : isSome ? "indeterminate" : false}
                               onCheckedChange={() => toggleAllInModule(module)}
                               disabled={!canEdit}
                             />
                             <div>
                               <span className="font-medium text-slate-700">{moduleInfo.label}</span>
                               {moduleInfo.description && (
                                 <p className="text-xs text-slate-400">{moduleInfo.description}</p>
                               )}
                             </div>
                          </div>
                        </td>
                        {ACTIONS.map(action => {
                          const isChecked = perms.some(p => p.module === module && p.action === action);
                          return (
                            <td key={action} className="text-center px-2 py-3">
                              <div className="flex justify-center">
                                <Checkbox 
                                  checked={isChecked}
                                  onCheckedChange={() => togglePermission(module, action)}
                                  disabled={!canEdit}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                     );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {canEdit ? 'Cancel' : 'Close'}
            </Button>
            {canEdit && (
              <Button type="submit" className="min-w-[120px]">
                Save Template
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
