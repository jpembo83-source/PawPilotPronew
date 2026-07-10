import { useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { Button } from '../../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { useUnsavedChangesGuard, formIsDirty } from '../../../../hooks/useUnsavedChangesGuard';
import { Pet } from '../../types';
import {
  PetEssentialFields,
  PetPhysicalFields,
  PetAddressFields,
  PetCareFields,
  PetVetFields,
  PetEnrolmentFields,
  initialPetFormData,
  buildPetPayload,
  type PetFormData,
} from '../forms/PetFormSections';

interface CreatePetModalProps {
  open: boolean;
  onClose: () => void;
  householdId: string;
  onPetCreated: (pet: Pet) => void;
}

export function CreatePetModal({ open, onClose, householdId, onPetCreated }: CreatePetModalProps) {
  const [formData, setFormData] = useState<PetFormData>(initialPetFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof PetFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Every dismissal path (Cancel button, overlay click, Escape) funnels
  // through here via the Dialog's onOpenChange, so a dirty form is always
  // guarded by the discard dialog. Dirty is a value diff against the initial
  // form — typing and then reverting doesn't count.
  const { requestClose, guardDialog } = useUnsavedChangesGuard({
    isDirty: () => formIsDirty(formData, initialPetFormData),
    onClose: () => {
      setFormData(initialPetFormData);
      setError(null);
      onClose();
    },
    description: "This pet hasn't been saved yet. Closing now will lose everything you've entered.",
  });

  const handleClose = async () => {
    await requestClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Pet name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Import the store dynamically to avoid circular dependencies
      const { useCustomerStore } = await import('../../store');
      const createPet = useCustomerStore.getState().createPet;

      const newPet = await createPet(householdId, buildPetPayload(formData));
      
      setFormData(initialPetFormData);
      onPetCreated(newPet);
      onClose();
    } catch (err: any) {
      console.error('Failed to create pet:', err);
      setError(err.message || 'Failed to create pet. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) void handleClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Pet</DialogTitle>
          <DialogDescription>
            Add a new pet to this household. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <Warning className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Core Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Core Information</h3>

            <PetEssentialFields formData={formData} onChange={handleChange} />
            <PetPhysicalFields formData={formData} onChange={handleChange} />
          </div>

          <PetAddressFields formData={formData} onChange={handleChange} />

          <PetCareFields formData={formData} onChange={handleChange} />

          <PetVetFields formData={formData} onChange={handleChange} />

          <PetEnrolmentFields formData={formData} onChange={handleChange} />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleClose()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Pet'}
            </Button>
          </div>
        </form>
      </DialogContent>
      {guardDialog}
    </Dialog>
  );
}