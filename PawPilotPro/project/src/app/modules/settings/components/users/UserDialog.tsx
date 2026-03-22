import React, { useState, useEffect } from 'react';
import { User, Role, useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../store';
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
import { Checkbox } from '../../../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { Shield, Info } from 'lucide-react';

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSave: (user: Partial<User>) => void;
}

export function UserDialog({ open, onOpenChange, user, onSave }: UserDialogProps) {
  const { templates } = useUserStore();
  const { locations } = useSettingsStore();

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'staff',
    locationIds: [],
    templateId: '',
    isActive: true,
    password: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({ ...user, password: '' });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'staff',
        locationIds: [],
        templateId: '',
        isActive: true
      });
    }
  }, [user, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (user && !dataToSave.password) {
      delete dataToSave.password;
    }
    onSave(dataToSave);
    onOpenChange(false);
  };

  const toggleLocation = (locId: string) => {
    const current = formData.locationIds || [];
    if (current.includes(locId)) {
      setFormData({ ...formData, locationIds: current.filter(id => id !== locId) });
    } else {
      setFormData({ ...formData, locationIds: [...current, locId] });
    }
  };

  const toggleAllLocations = () => {
    const current = formData.locationIds || [];
    if (current.includes('all')) {
      setFormData({ ...formData, locationIds: [] });
    } else {
      setFormData({ ...formData, locationIds: ['all'] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {user ? 'Update the user details and permissions below.' : 'Fill in the details to create a new user account.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="jane@company.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input 
                type="password"
                value={formData.password || ''} 
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder={user ? "Leave blank to keep unchanged" : "Set password"}
                required={!user}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(val: Role) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {formData.role === 'admin' && 'Full system access across all locations.'}
                {formData.role === 'manager' && 'Manage assigned locations and staff.'}
                {formData.role === 'staff' && 'Operational access defined by template.'}
              </p>
            </div>

            {/* Permission template for non-admin roles */}
            {formData.role !== 'admin' && (
              <div className="space-y-2 col-span-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <Label>Permission Template</Label>
                </div>
                <Select 
                  value={formData.templateId || ''} 
                  onValueChange={(val) => setFormData({ ...formData, templateId: val === 'none' ? '' : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-slate-500">No template (use role defaults)</span>
                    </SelectItem>
                    {templates.map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <div className="flex items-center gap-2">
                          <span>{tpl.name}</span>
                          {tpl.isSystem && (
                            <Badge variant="secondary" className="text-[10px] h-4">System</Badge>
                          )}
                          <span className="text-xs text-slate-400">
                            ({tpl.permissions.length} permissions)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.templateId && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Template permissions will override role defaults for this user
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center">
              <Label>Location Access</Label>
              {formData.role === 'admin' && (
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="all-locs" 
                    checked={(formData.locationIds || []).includes('all')}
                    onCheckedChange={toggleAllLocations}
                  />
                  <label htmlFor="all-locs" className="text-sm cursor-pointer">All Locations (Global)</label>
                </div>
              )}
            </div>
            
            {locations.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-md bg-slate-50">
                <p className="text-sm text-slate-500">No locations available yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Please create locations in <strong>Settings → Locations</strong> first.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                {locations.filter(loc => loc != null && loc.id != null).map(loc => (
                  <div key={loc.id} className="flex items-center space-x-2 border p-2 rounded-md hover:bg-slate-50">
                    <Checkbox 
                      id={`loc-${loc.id}`}
                      checked={(formData.locationIds || []).includes(loc.id) || (formData.locationIds || []).includes('all')}
                      disabled={(formData.locationIds || []).includes('all')}
                      onCheckedChange={() => toggleLocation(loc.id)}
                    />
                    <label
                      htmlFor={`loc-${loc.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {loc.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save User</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}