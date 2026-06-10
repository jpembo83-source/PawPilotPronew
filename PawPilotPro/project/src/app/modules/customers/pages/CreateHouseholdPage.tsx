// Create Household Page
// Form for creating a new household with contacts and pets

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useCustomerStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import type { Household } from '../types';

export function CreateHouseholdPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createHousehold, isLoading } = useCustomerStore();
  const { locations, fetchLocations } = useSettingsStore();
  
  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);
  
  const [formData, setFormData] = useState({
    name: '',
    external_id: '',
    preferred_location_id: '',
    notes: '',
    status: 'active' as const,
    vip: false,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Household name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const household = await createHousehold({
        ...formData,
        name: formData.name.trim(),
        external_id: formData.external_id.trim() || undefined,
        preferred_location_id: formData.preferred_location_id || undefined,
        notes: formData.notes.trim() || undefined,
      });
      
      toast.success(`Household created: ${household.name}`);
      
      // Navigate to the newly created household detail page
      navigate(`/customers/${household.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create household');
    }
  };
  
  const handleCancel = () => {
    navigate('/customers');
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        
        <h1 className="text-3xl font-bold text-slate-900">Create New Household</h1>
        <p className="text-slate-600 mt-2">
          Add a new customer household to your system
        </p>
      </div>
      
      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Household Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Household Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                Household Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="e.g., Smith Family, Jones Household"
                autoFocus
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
              <p className="text-slate-500 text-xs mt-1">
                This is typically the family surname or a descriptive name
              </p>
            </div>
            
            {/* External ID */}
            <div>
              <label htmlFor="external_id" className="block text-sm font-medium text-slate-700 mb-1">
                External ID
              </label>
              <input
                id="external_id"
                type="text"
                value={formData.external_id}
                onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional reference ID from another system"
              />
              <p className="text-slate-500 text-xs mt-1">
                Use this to link to external systems (e.g., accounting software)
              </p>
            </div>
            
            {/* Preferred Location */}
            <div>
              <label htmlFor="preferred_location_id" className="block text-sm font-medium text-slate-700 mb-1">
                Preferred Location
              </label>
              <select
                id="preferred_location_id"
                value={formData.preferred_location_id}
                onChange={(e) => setFormData({ ...formData, preferred_location_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a location (optional)</option>
                {locations.map(location => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
              <p className="text-slate-500 text-xs mt-1">
                The location this household typically uses
              </p>
            </div>
            
            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            
            {/* VIP Status */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="vip"
                  type="checkbox"
                  checked={formData.vip}
                  onChange={(e) => setFormData({ ...formData, vip: e.target.checked })}
                  className="w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="vip" className="text-sm font-medium text-slate-700">
                  VIP Customer
                </label>
                <p className="text-slate-500 text-xs">
                  Mark this household as a VIP for priority treatment
                </p>
              </div>
            </div>
            
            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional information about this household"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Household
              </>
            )}
          </Button>
        </div>
      </form>
      
      {/* Help Text */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
          <p className="text-blue-800 text-sm">
            After creating this household, you'll be able to add:
          </p>
          <ul className="text-blue-800 text-sm mt-2 space-y-1 list-disc list-inside">
            <li>Contact information for household members</li>
            <li>Pet profiles and medical information</li>
            <li>Documents and compliance records</li>
            <li>Payment methods and billing details</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}