import React, { useState, useEffect } from 'react';
import { Plus, MagnifyingGlass, MapPin, DotsThree, Power, PencilSimple, Trash } from '@phosphor-icons/react';
import { useSettingsStore, Location } from '../store';
import { MODULES } from '../constants/modules';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";

export function LocationSettings() {
  const { locations, globalEnabledModules, organisation, addLocation, updateLocation, deleteLocation, toggleLocationStatus, toggleLocationModule, logAction, fetchLocations } = useSettingsStore();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Fetch locations on mount - only when authenticated
  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchLocations();
    }
  }, [fetchLocations, isAuthLoading, user]);

  // Form state for creating/editing
  const [formData, setFormData] = useState<Partial<Location>>({
    name: '',
    address: '',
    phone: '',
    email: '',
    timezone: 'Europe/London',
    capacity: { maxDogs: 30, smallDogLimit: 15, largeDogLimit: 15 },
    isActive: true
  });

  // Default to all modules if undefined (legacy state migration)
  const effectiveGlobalModules = globalEnabledModules ?? ['daycare', 'grooming', 'boutique', 'transport'];

  const filteredLocations = locations.filter(loc => 
    loc && loc.name && loc.address &&
    (loc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    loc.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: '',
      timezone: 'Europe/London',
      capacity: { maxDogs: 30, smallDogLimit: 15, largeDogLimit: 15 },
      isActive: true
    });
    setEditingLocation(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (loc: Location) => {
    setFormData(loc);
    setEditingLocation(loc);
    setIsCreateOpen(true);
  };

  const handleOpenDelete = (loc: Location) => {
    setDeletingLocation(loc);
    setIsDeleteOpen(true);
    setDeleteConfirmName('');
  };

  const updateCapacity = (field: 'smallDogLimit' | 'largeDogLimit', value: number) => {
    const currentCapacity = formData.capacity || { maxDogs: 0, smallDogLimit: 0, largeDogLimit: 0 };
    const newCapacity = { ...currentCapacity, [field]: value };
    newCapacity.maxDogs = (newCapacity.smallDogLimit || 0) + (newCapacity.largeDogLimit || 0);
    setFormData({ ...formData, capacity: newCapacity });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address) return;

    if (editingLocation) {
      updateLocation(editingLocation.id, formData);
      logAction('UPDATE_LOCATION', `Updated location: ${formData.name}`, 'Admin');
      toast.success('Location updated successfully');
    } else {
      addLocation(formData as Location)
        .then(() => {
          logAction('CREATE_LOCATION', `Created location: ${formData.name}`, 'Admin');
          toast.success('New location added');
          // Refetch to ensure we have the latest data from the server
          fetchLocations();
        })
        .catch((error) => {
          console.error('Error adding location:', error);
          toast.error('Failed to add location', {
            description: error.message || 'Please try again',
          });
        });
    }
    setIsCreateOpen(false);
  };

  const handleToggleStatus = (id: string, currentStatus: boolean, name: string) => {
    // In a real app, we might ask for confirmation if deactivating
    toggleLocationStatus(id);
    logAction('TOGGLE_LOCATION_STATUS', `${currentStatus ? 'Deactivated' : 'Activated'} location: ${name}`, 'Admin');
    toast.success(`Location ${currentStatus ? 'deactivated' : 'activated'}`);
  };

  const handleDelete = async () => {
    if (!deletingLocation) return;
    
    // Check if user is admin
    if (user?.role !== 'admin') {
      toast.error('Permission denied', {
        description: 'Only administrators can delete locations',
      });
      return;
    }
    
    try {
      await deleteLocation(deletingLocation.id);
      logAction('DELETE_LOCATION', `Deleted location: ${deletingLocation.name}`, user?.email || 'Admin');
      toast.success(`Location "${deletingLocation.name}" deleted successfully`);
      setIsDeleteOpen(false);
      setDeleteConfirmName('');
      // Refetch to ensure we have the latest data from the server
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Failed to delete location', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };
  
  // Check if delete button should be enabled
  const isDeleteEnabled = deleteConfirmName === deletingLocation?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Locations</h2>
          <p className="text-sm text-slate-500">Manage your physical branches and their capacities.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-3">Location Name</th>
                <th className="px-6 py-3">Modules</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3 text-center">Capacity</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No locations found.
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => (
                  <tr 
                    key={loc.id} 
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => handleOpenEdit(loc)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-primary shrink-0">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{loc.name}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{loc.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(loc.enabledModules || ['daycare', 'grooming']).map(modId => {
                          const mod = MODULES.find(m => m.id === modId);
                          if (!mod) return null;
                          return (
                            <span key={modId} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {mod.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600">
                        <p>{loc.phone}</p>
                        <p className="text-xs text-slate-400">{loc.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {loc.capacity.maxDogs} Max
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(loc);
                        }}
                      >
                        <PencilSimple className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDelete(loc);
                        }}
                      >
                        <Trash className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle>
            <DialogDescription>
              Configure the branch details and capacity limits.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
            <div className="overflow-y-auto px-1 -mx-1 flex-1">
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="loc-name">Location Name</Label>
                  <Input 
                    id="loc-name" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    placeholder="e.g. Downtown Branch"
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="loc-address">Address</Label>
                  <Input 
                    id="loc-address" 
                    value={formData.address} 
                    onChange={(e) => setFormData({...formData, address: e.target.value})} 
                    placeholder="Full street address"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-phone">Phone</Label>
                  <Input 
                    id="loc-phone" 
                    value={formData.phone} 
                    onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                    placeholder={`${organisation.dialCode} ...`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-email">Email</Label>
                  <Input 
                    id="loc-email" 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    placeholder="branch@mdc.com"
                  />
                </div>
                
                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-sm font-medium text-slate-900 mb-3">Daily Capacity Limits</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cap-total">Total Max</Label>
                      <Input 
                        id="cap-total" 
                        type="text"
                        value={formData.capacity?.maxDogs} 
                        readOnly
                        className="bg-slate-100 text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cap-small">Small Dogs</Label>
                      <Input 
                        id="cap-small" 
                        type="number"
                        value={formData.capacity?.smallDogLimit} 
                        onChange={(e) => updateCapacity('smallDogLimit', parseInt(e.target.value)||0)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cap-large">Large Dogs</Label>
                      <Input 
                        id="cap-large" 
                        type="number"
                        value={formData.capacity?.largeDogLimit} 
                        onChange={(e) => updateCapacity('largeDogLimit', parseInt(e.target.value)||0)} 
                      />
                    </div>
                  </div>
                </div>
                
                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-sm font-medium text-slate-900 mb-3">Enabled Modules</h4>
                  <div className="space-y-3">
                    {MODULES.filter(m => !m.isCore).map(module => {
                      const isGloballyEnabled = effectiveGlobalModules.includes(module.id);
                      const isLocallyEnabled = (formData.enabledModules || []).includes(module.id);

                      return (
                        <div key={module.id} className="flex items-center justify-between p-3 border rounded-md bg-slate-50">
                          <div className="flex items-center gap-3">
                            <module.icon className={`h-5 w-5 ${isGloballyEnabled ? 'text-slate-600' : 'text-slate-300'}`} />
                            <div>
                              <p className={`text-sm font-medium ${isGloballyEnabled ? 'text-slate-900' : 'text-slate-400'}`}>{module.label}</p>
                              {!isGloballyEnabled && <p className="text-xs text-slate-400">Disabled at organisation level</p>}
                            </div>
                          </div>
                          <Switch 
                            checked={isLocallyEnabled} 
                            disabled={!isGloballyEnabled}
                            onCheckedChange={(checked) => {
                               const currentModules = formData.enabledModules || [];
                               const newModules = checked 
                                 ? [...currentModules, module.id] 
                                 : currentModules.filter(id => id !== module.id);
                               setFormData({...formData, enabledModules: newModules});
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit">Save Location</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location: {deletingLocation?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the location and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {user?.role !== 'admin' ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ Permission Denied
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Only administrators can delete locations.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-700">
                  To confirm deletion, please type the location name: <span className="font-semibold text-slate-900">{deletingLocation?.name}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="confirm-name">Location Name</Label>
                  <Input 
                    id="confirm-name"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder="Type location name to confirm"
                    className="font-mono"
                  />
                </div>
              </>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmName('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={!isDeleteEnabled || user?.role !== 'admin'}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}