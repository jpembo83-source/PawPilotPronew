import React, { useState, useEffect } from 'react';
import { useUserStore, User } from '../../stores/userStore';
import { useSettingsStore } from '../../store';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Plus, Search, Filter, MoreHorizontal, User as UserIcon, Shield, MapPin, Loader2 } from 'lucide-react';
import { UserDialog } from './UserDialog';
import { ViewAsButton } from '../../../../modules/view-as/ViewAsButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu';

export function UserList() {
  const { users, templates, addUser, updateUser, toggleUserStatus, fetchUsers, isLoading } = useUserStore();
  const { locations } = useSettingsStore();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreate = () => {
    setEditingUser(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  const handleSave = (userData: Partial<User>) => {
    // In a real app, actorName would come from auth context
    const actorName = 'Current Admin'; 

    if (editingUser) {
      updateUser(editingUser.id, userData, actorName);
    } else {
      addUser(userData as Omit<User, 'id'>, actorName);
    }
  };

  const getTemplateName = (id?: string) => {
    if (!id) return null;
    return templates.find(t => t.id === id)?.name || 'Unknown Template';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search users..." 
              className="pl-9" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="h-10 rounded-md border border-slate-200 text-sm px-3 bg-white"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-3 whitespace-nowrap">User</th>
                <th className="px-6 py-3 whitespace-nowrap">Role & Access</th>
                <th className="px-6 py-3 whitespace-nowrap">Locations</th>
                <th className="px-6 py-3 whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-right whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                          <UserIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {user.role}
                          </Badge>
                          {user.role === 'admin' && <Shield className="h-3 w-3 text-amber-500" />}
                        </div>
                        {user.role !== 'admin' && user.templateId && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit whitespace-nowrap flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {getTemplateName(user.templateId)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.locationIds.includes('all') ? (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 whitespace-nowrap">
                          Global Access
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 min-w-[120px]">
                          {user.locationIds.map(locId => {
                            const loc = locations.find(l => l?.id === locId);
                            return loc ? (
                              <span key={locId} className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 flex items-center gap-1 whitespace-nowrap">
                                <MapPin className="h-3 w-3" /> {loc.name}
                              </span>
                            ) : null;
                          }).filter(Boolean)}
                          {user.locationIds.length === 0 && <span className="text-xs text-red-500 whitespace-nowrap">Unassigned</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <ViewAsButton 
                          targetUserId={user.id}
                          targetUserName={user.name}
                          targetUserRole={user.role}
                          disabled={!user.isActive}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                               // Mock sending reset
                               alert(`Reset link sent to ${user.email}`);
                            }}>
                              Send Password Reset
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className={user.isActive ? "text-red-600" : ""}
                              onClick={() => toggleUserStatus(user.id, 'Current Admin')}
                            >
                              {user.isActive ? 'Disable User' : 'Enable User'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        user={editingUser} 
        onSave={handleSave} 
      />
    </div>
  );
}