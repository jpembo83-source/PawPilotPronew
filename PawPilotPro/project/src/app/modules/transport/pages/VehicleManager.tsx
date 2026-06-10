/**
 * Vehicle Manager - Production-grade fleet management
 * NO SEED/MOCK DATA - All vehicles stored in backend with tenant isolation
 * British English throughout
 */

import React, { useState, useEffect } from 'react';
import { useTransportStore } from '../store';
import { useUserStore } from '../../settings/stores/userStore';
import type { Vehicle } from '../types';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Truck, Plus, Trash, PencilSimple, CircleNotch, Warning, User } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { useSettingsStore } from '../../settings/store';
import { useAuth } from '@/app/context/AuthContext';

export function VehicleManager() {
  const { vehicles, isLoading, error, fetchVehicles, createVehicle, updateVehicle, deleteVehicle } = useTransportStore();
  const { users, fetchUsers } = useUserStore();
  const { locations } = useSettingsStore();
  const { session } = useAuth();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    name: '',
    licence_plate: '',
    capacity: 4,
    location_id: '',
    is_active: true
  });
  
  // Fetch vehicles and users on mount
  useEffect(() => {
    fetchVehicles();
    fetchUsers(); // Fetch real authenticated users
  }, []);
  
  // Get active users with the Driver template assigned
  const availableDrivers = React.useMemo(() => {
    return users
      .filter(u => u.isActive && u.templateId === 'tpl-driver')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);
  
  const handleOpenCreate = () => {
    setEditingVehicle(null);
    setFormData({
      name: '',
      licence_plate: '',
      capacity: 4,
      location_id: locations[0]?.id || '',
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData(vehicle);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.licence_plate || !formData.location_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Prepare clean data - only send fields that should be updated
      const cleanData: any = {
        name: formData.name,
        licence_plate: formData.licence_plate,
        capacity: formData.capacity,
        location_id: formData.location_id,
        is_active: formData.is_active !== undefined ? formData.is_active : true,
      };
      
      // Handle assigned_driver_user_id - convert empty string to null
      if (formData.assigned_driver_user_id && formData.assigned_driver_user_id.trim() !== '') {
        cleanData.assigned_driver_user_id = formData.assigned_driver_user_id;
      } else {
        cleanData.assigned_driver_user_id = null;
      }
      
      if (formData.notes) {
        cleanData.notes = formData.notes;
      }
      
      console.log('[VehicleManager] Submitting vehicle data:', cleanData);
      
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, cleanData);
      } else {
        await createVehicle(cleanData);
      }
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to save vehicle:', err);
      alert('Failed to save vehicle. Please try again.');
    }
  };

  const handleDelete = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) {
      return;
    }
    
    try {
      await deleteVehicle(vehicleId);
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
      alert('Failed to delete vehicle. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-xl font-semibold text-slate-900">Fleet Management</h2>
           <p className="text-sm text-slate-500">Manage vehicles and capacities</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <Warning className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && vehicles.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <CircleNotch className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-500">Loading vehicles...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && vehicles.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-12 text-center">
          <Truck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Vehicles Yet</h3>
          <p className="text-slate-500 mb-4">Add your first transport vehicle to get started</p>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </div>
      )}

      {/* Vehicles Grid */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(vehicle => (
            <div key={vehicle.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                     <Truck className="h-5 w-5" />
                   </div>
                   <div>
                     <h3 className="font-medium text-slate-900">{vehicle.name}</h3>
                     <p className="text-xs text-slate-500">{vehicle.licence_plate}</p>
                   </div>
                 </div>
                 <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${vehicle.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                   {vehicle.is_active ? 'Active' : 'Inactive'}
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mt-2">
                 <div>
                   <span className="text-slate-400 text-xs block">Capacity</span>
                   {vehicle.capacity} Dogs
                 </div>
                 <div>
                   <span className="text-slate-400 text-xs block">Base</span>
                   {locations.find(l => l.id === vehicle.location_id)?.name || 'Unknown'}
                 </div>
              </div>

              {vehicle.assigned_driver_user_id && (
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {users.find(u => u.id === vehicle.assigned_driver_user_id)?.name || 'Assigned Driver'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
                 <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(vehicle)}>
                   <PencilSimple className="h-4 w-4" />
                 </Button>
                 <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(vehicle.id)}>
                   <Trash className="h-4 w-4" />
                 </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
            <DialogDescription>
              {editingVehicle ? 'Update the vehicle details.' : 'Enter details for the new vehicle.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Name</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Blue Van" />
            </div>
            <div className="space-y-2">
              <Label>Licence Plate</Label>
              <Input value={formData.licence_plate} onChange={e => setFormData({...formData, licence_plate: e.target.value})} placeholder="XYZ 123" />
            </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Capacity (Dogs)</Label>
                 <Input type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})} />
               </div>
               <div className="space-y-2">
                 <Label>Home Location</Label>
                 <select 
                   className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm"
                   value={formData.location_id}
                   onChange={e => setFormData({...formData, location_id: e.target.value})}
                 >
                   <option value="">Select Location</option>
                   {locations.map(loc => (
                     <option key={loc.id} value={loc.id}>{loc.name}</option>
                   ))}
                 </select>
               </div>
             </div>
             <div className="space-y-2">
               <Label>Assigned Driver (Optional)</Label>
               <select 
                 className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm"
                 value={formData.assigned_driver_user_id || ''}
                 onChange={e => setFormData({...formData, assigned_driver_user_id: e.target.value || undefined})}
               >
                 <option value="">No driver assigned</option>
                 {availableDrivers.map(user => (
                     <option key={user.id} value={user.id}>
                       {user.name}
                     </option>
                   ))}
               </select>
               <p className="text-xs text-slate-500 mt-1">
                 Assign a default driver to this vehicle. Drivers must have a system login.
               </p>
             </div>
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
               <Button type="submit" disabled={isLoading}>
                 {isLoading ? <CircleNotch className="h-4 w-4 mr-2 animate-spin" /> : null}
                 Save
               </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}