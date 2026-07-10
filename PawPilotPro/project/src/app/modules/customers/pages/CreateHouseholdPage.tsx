// Create Household Page
// Form for creating a new household with contacts and pets

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useCustomerStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import {
  HouseholdFormFields,
  initialHouseholdFormData,
  validateHouseholdForm,
  buildHouseholdPayload,
} from '../components/forms/HouseholdFormFields';

import { useBackNavigation } from '../../../components/BackButton';
export function CreateHouseholdPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/customers');
  const { createHousehold, isLoading } = useCustomerStore();
  const { locations, fetchLocations } = useSettingsStore();

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const [formData, setFormData] = useState(initialHouseholdFormData);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors = validateHouseholdForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const household = await createHousehold(buildHouseholdPayload(formData));
      
      toast.success(`Household created: ${household.name}`);
      
      // Navigate to the newly created household detail page
      navigate(`/customers/${household.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create household');
    }
  };
  
  const handleCancel = () => {
    goBack();
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
          <CardContent>
            <HouseholdFormFields
              formData={formData}
              errors={errors}
              onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
              locations={locations}
            />
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