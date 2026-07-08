import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Warning, CircleNotch } from '@phosphor-icons/react';
import { useCustomerStore } from '../../store';
import { toast } from 'sonner';
import {
  ContactBasicFields,
  ContactSettingsFields,
  ContactConsentFields,
  ContactAddressFields,
  initialContactFormData,
  validateContactForm,
  buildContactPayload,
  type ContactFormData,
} from '../forms/ContactFormSections';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  householdId: string;
  onContactAdded?: () => void;
}

export function AddContactModal({ open, onClose, householdId, onContactAdded }: AddContactModalProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialContactFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createContact, fetchHouseholdDetail } = useCustomerStore();

  const handleChange = (field: keyof ContactFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    const validationError = validateContactForm(formData);
    if (validationError) {
      setError(validationError);
      return false;
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
      // Create the contact
      await createContact(householdId, buildContactPayload(formData));

      // Refresh the household detail to get updated contacts
      await fetchHouseholdDetail(householdId);

      toast.success(`Contact added: ${formData.first_name} ${formData.last_name}`);
      
      // Reset form
      setFormData(initialContactFormData);
      
      // Call callback if provided
      onContactAdded?.();
      
      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Failed to create contact:', err);
      setError(err.message || 'Failed to create contact. Please try again.');
      toast.error('Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData(initialContactFormData);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Add a new contact to this household. Contacts can be pet owners, emergency contacts, or authorized pick-up persons.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <Warning className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <ContactBasicFields formData={formData} onChange={handleChange} disabled={isSubmitting} />

          <ContactSettingsFields formData={formData} onChange={handleChange} disabled={isSubmitting} />

          <ContactConsentFields formData={formData} onChange={handleChange} disabled={isSubmitting} />

          <ContactAddressFields formData={formData} onChange={handleChange} disabled={isSubmitting} />

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
              {isSubmitting ? 'Adding Contact...' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}