import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Textarea } from '../../../../components/ui/textarea';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Warning, CircleNotch } from '@phosphor-icons/react';
import { useCustomerStore } from '../../store';
import { useSettingsStore } from '../../../settings/store';
import { toast } from 'sonner';
import type { Pet, PetSex } from '../../types';
import { useUnsavedChangesGuard, formIsDirty } from '../../../../hooks/useUnsavedChangesGuard';

interface EditPetModalProps {
  open: boolean;
  onClose: () => void;
  pet: Pet;
  onPetUpdated?: () => void;
}

interface PetFormData {
  name: string;
  breed: string;
  sex: PetSex | '';
  date_of_birth: string;
  microchip: string;
  weight_kg: string;
  colour: string;
  neutered_status: 'spayed' | 'castrated' | 'none' | '';
  feeding_instructions: string;
  allergies: string;
  vet_name: string;
  vet_phone: string;
  vet_address: string;
  active: boolean;
  daycare_enrolled: boolean;
  grooming_enrolled: boolean;
  transport_enrolled: boolean;
  overnights_enrolled: boolean;
}

export function EditPetModal({ open, onClose, pet, onPetUpdated }: EditPetModalProps) {
  const [formData, setFormData] = useState<PetFormData>({
    name: pet.name,
    breed: pet.breed || '',
    sex: pet.sex || '',
    date_of_birth: pet.date_of_birth || '',
    microchip: pet.microchip || '',
    weight_kg: pet.weight_kg?.toString() || '',
    colour: pet.colour || '',
    neutered_status: pet.neutered_status || '',
    feeding_instructions: pet.feeding_instructions || '',
    allergies: pet.allergies || '',
    vet_name: pet.vet_name || '',
    vet_phone: pet.vet_phone || '',
    vet_address: pet.vet_address || '',
    active: pet.active,
    daycare_enrolled: pet.daycare_enrolled,
    grooming_enrolled: pet.grooming_enrolled,
    transport_enrolled: pet.transport_enrolled,
    overnights_enrolled: pet.overnights_enrolled,
  });
  const [initialFormData, setInitialFormData] = useState<PetFormData>(formData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updatePet, fetchPetProfile } = useCustomerStore();
  const { globalEnabledModules } = useSettingsStore();
  
  // Define service enrollment mapping
  const services = [
    { id: 'daycare', label: 'Daycare', field: 'daycare_enrolled' as keyof PetFormData },
    { id: 'grooming', label: 'Grooming', field: 'grooming_enrolled' as keyof PetFormData },
    { id: 'transport', label: 'Transport', field: 'transport_enrolled' as keyof PetFormData },
    { id: 'overnights', label: 'Overnights', field: 'overnights_enrolled' as keyof PetFormData },
  ];
  
  // Filter services based on globally enabled modules
  const enabledServices = services.filter(service => 
    globalEnabledModules.includes(service.id)
  );

  // Update form data when pet changes
  useEffect(() => {
    const newFormData = {
      name: pet.name,
      breed: pet.breed || '',
      sex: pet.sex || '',
      date_of_birth: pet.date_of_birth || '',
      microchip: pet.microchip || '',
      weight_kg: pet.weight_kg?.toString() || '',
      colour: pet.colour || '',
      neutered_status: pet.neutered_status || '',
      feeding_instructions: pet.feeding_instructions || '',
      allergies: pet.allergies || '',
      vet_name: pet.vet_name || '',
      vet_phone: pet.vet_phone || '',
      vet_address: pet.vet_address || '',
      active: pet.active,
      daycare_enrolled: pet.daycare_enrolled,
      grooming_enrolled: pet.grooming_enrolled,
      transport_enrolled: pet.transport_enrolled,
      overnights_enrolled: pet.overnights_enrolled,
    };
    setFormData(newFormData);
    setInitialFormData(newFormData);
  }, [pet]);

  const { requestClose, guardDialog } = useUnsavedChangesGuard({
    isDirty: () => formIsDirty(formData, initialFormData),
    onClose,
  });

  const handleChange = (field: keyof PetFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Pet name is required');
      return false;
    }
    if (formData.weight_kg && isNaN(parseFloat(formData.weight_kg))) {
      setError('Weight must be a valid number');
      return false;
    }
    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      if (dob > today) {
        setError('Date of birth cannot be in the future');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare update data
      const updateData: any = {
        name: formData.name,
        breed: formData.breed || undefined,
        sex: formData.sex || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        microchip: formData.microchip || undefined,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : undefined,
        colour: formData.colour || undefined,
        neutered_status: formData.neutered_status || undefined,
        feeding_instructions: formData.feeding_instructions || undefined,
        allergies: formData.allergies || undefined,
        vet_name: formData.vet_name || undefined,
        vet_phone: formData.vet_phone || undefined,
        vet_address: formData.vet_address || undefined,
        active: formData.active,
        daycare_enrolled: formData.daycare_enrolled,
        grooming_enrolled: formData.grooming_enrolled,
        transport_enrolled: formData.transport_enrolled,
        overnights_enrolled: formData.overnights_enrolled,
      };

      // Update the pet
      await updatePet(pet.id, updateData);

      // Refresh the pet profile to get updated data
      await fetchPetProfile(pet.id);

      toast.success(`Pet updated: ${formData.name}`);
      
      // Call callback if provided
      onPetUpdated?.();
      
      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Failed to update pet:', err);
      setError(err.message || 'Failed to update pet. Please try again.');
      toast.error('Failed to update pet');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Every dismissal path (Cancel button, overlay click, Escape) funnels
  // through here, so a dirty form is always guarded by the discard dialog.
  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      void requestClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pet</DialogTitle>
          <DialogDescription>
            Update information for {pet.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <Warning className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Max"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="breed">Breed</Label>
                <Input
                  id="breed"
                  value={formData.breed}
                  onChange={(e) => handleChange('breed', e.target.value)}
                  placeholder="Labrador Retriever"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select
                  value={formData.sex}
                  onValueChange={(value: PetSex) => handleChange('sex', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="sex">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange('date_of_birth', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="neutered_status">Neutered/Spayed</Label>
                <Select
                  value={formData.neutered_status}
                  onValueChange={(value) => handleChange('neutered_status', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="neutered_status">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="castrated">Castrated (Male)</SelectItem>
                    <SelectItem value="spayed">Spayed (Female)</SelectItem>
                    <SelectItem value="none">Not Neutered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="colour">Colour</Label>
                <Input
                  id="colour"
                  value={formData.colour}
                  onChange={(e) => handleChange('colour', e.target.value)}
                  placeholder="Golden"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.1"
                  value={formData.weight_kg}
                  onChange={(e) => handleChange('weight_kg', e.target.value)}
                  placeholder="25.5"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="microchip">Microchip</Label>
                <Input
                  id="microchip"
                  value={formData.microchip}
                  onChange={(e) => handleChange('microchip', e.target.value)}
                  placeholder="123456789012345"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Care Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Care Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="feeding_instructions">Feeding Instructions</Label>
              <Textarea
                id="feeding_instructions"
                value={formData.feeding_instructions}
                onChange={(e) => handleChange('feeding_instructions', e.target.value)}
                placeholder="2 cups dry food twice daily, no table scraps"
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                value={formData.allergies}
                onChange={(e) => handleChange('allergies', e.target.value)}
                placeholder="Chicken, grass pollen"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
          </div>

          {/* Veterinary Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Veterinary Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vet_name">Vet Name</Label>
                <Input
                  id="vet_name"
                  value={formData.vet_name}
                  onChange={(e) => handleChange('vet_name', e.target.value)}
                  placeholder="Dr. Smith"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vet_phone">Vet Phone</Label>
                <Input
                  id="vet_phone"
                  type="tel"
                  value={formData.vet_phone}
                  onChange={(e) => handleChange('vet_phone', e.target.value)}
                  placeholder="01234 567890"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vet_address">Vet Address</Label>
              <Textarea
                id="vet_address"
                value={formData.vet_address}
                onChange={(e) => handleChange('vet_address', e.target.value)}
                placeholder="123 Main St, City, Postcode"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
          </div>

          {/* Service Enrollment */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Service Enrollment</h3>
            
            <div className="grid grid-cols-2 gap-3">
              {enabledServices.map(service => (
                <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor={service.field} className="font-medium cursor-pointer">
                    {service.label}
                  </Label>
                  <Switch
                    id={service.field}
                    checked={formData[service.field]}
                    onCheckedChange={(checked) => handleChange(service.field, checked)}
                    disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Status</h3>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="active" className="font-medium cursor-pointer">
                  Active
                </Label>
                <p className="text-sm text-slate-600">
                  Pet can be booked for services
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleChange('active', checked)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <CircleNotch className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? 'Updating Pet...' : 'Update Pet'}
            </Button>
          </div>
        </form>
      </DialogContent>
      {guardDialog}
    </Dialog>
  );
}