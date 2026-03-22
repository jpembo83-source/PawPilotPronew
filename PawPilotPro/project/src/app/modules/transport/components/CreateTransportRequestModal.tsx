import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { AlertCircle, Loader2, MapPin, User, Dog } from 'lucide-react';
import { ContactSelector } from '../../../components/shared/ContactSelector';
import { useCustomerStore } from '../../customers/store';
import { useTransportStore } from '../store';
import { toast } from 'sonner';
import type { HouseholdContact } from '../../customers/types';
import type { TransportType, TransportReason } from '../store';

interface CreateTransportRequestModalProps {
  open: boolean;
  onClose: () => void;
  householdId?: string;
  petId?: string;
  date?: string;
}

interface TransportRequestFormData {
  householdId: string;
  petId: string;
  contactId: string;
  date: string;
  type: TransportType;
  reason: TransportReason;
  pickupAddress: string;
  timeWindow: string;
  notes: string;
}

const initialFormData: TransportRequestFormData = {
  householdId: '',
  petId: '',
  contactId: '',
  date: '',
  type: 'pickup',
  reason: 'daycare',
  pickupAddress: '',
  timeWindow: '',
  notes: '',
};

export function CreateTransportRequestModal({ 
  open, 
  onClose, 
  householdId: prefilledHouseholdId,
  petId: prefilledPetId,
  date: prefilledDate,
}: CreateTransportRequestModalProps) {
  const [formData, setFormData] = useState<TransportRequestFormData>({
    ...initialFormData,
    householdId: prefilledHouseholdId || '',
    petId: prefilledPetId || '',
    date: prefilledDate || new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<HouseholdContact | undefined>();
  
  const { households, currentHouseholdDetail, fetchHouseholdDetail } = useCustomerStore();
  // const { createTransportRequest } = useTransportStore(); // Will be implemented

  const handleChange = (field: keyof TransportRequestFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    
    // If household changes, reset contact and pet
    if (field === 'householdId' && value !== formData.householdId) {
      setFormData(prev => ({ ...prev, contactId: '', petId: '' }));
      setSelectedContact(undefined);
      // Fetch household details to get contacts and pets
      fetchHouseholdDetail(value);
    }
  };

  const handleContactChange = (contactId: string, contact: HouseholdContact | undefined) => {
    setFormData(prev => ({ ...prev, contactId }));
    setSelectedContact(contact);
    
    // Auto-fill address from household if available
    if (contact && currentHouseholdDetail?.address) {
      const addr = currentHouseholdDetail.address;
      const fullAddress = [
        addr.line1,
        addr.line2,
        addr.city,
        addr.postcode,
      ].filter(Boolean).join(', ');
      
      if (fullAddress && !formData.pickupAddress) {
        setFormData(prev => ({ ...prev, pickupAddress: fullAddress }));
      }
    }
  };

  const validateForm = (): boolean => {
    if (!formData.householdId) {
      setError('Please select a household');
      return false;
    }
    if (!formData.contactId) {
      setError('Please select a contact person');
      return false;
    }
    if (!formData.petId) {
      setError('Please select a pet');
      return false;
    }
    if (!formData.date) {
      setError('Please select a date');
      return false;
    }
    if (!formData.pickupAddress.trim()) {
      setError('Please enter a pickup address');
      return false;
    }
    if (!formData.timeWindow.trim()) {
      setError('Please enter a time window');
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
      // Get pet and contact details for the request
      const pet = currentHouseholdDetail?.pets.find(p => p.id === formData.petId);
      const contact = selectedContact;
      
      if (!pet || !contact) {
        throw new Error('Pet or contact not found');
      }

      // Create transport request with contact information
      const requestData = {
        petId: formData.petId,
        petName: pet.name,
        ownerName: `${contact.first_name} ${contact.last_name}`,
        contactPhone: contact.phone || '',
        contactEmail: contact.email || '',
        contactId: contact.id,
        householdId: formData.householdId,
        address: formData.pickupAddress,
        date: formData.date,
        type: formData.type,
        reason: formData.reason,
        timeWindow: formData.timeWindow,
        notes: formData.notes,
        status: 'pending' as const,
      };

      // TODO: Call API to create transport request
      console.log('Creating transport request:', requestData);
      
      toast.success(`Transport request created for ${pet.name}`);
      
      // Reset form
      setFormData({
        ...initialFormData,
        date: prefilledDate || new Date().toISOString().split('T')[0],
      });
      setSelectedContact(undefined);
      
      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Failed to create transport request:', err);
      setError(err.message || 'Failed to create transport request. Please try again.');
      toast.error('Failed to create transport request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        ...initialFormData,
        householdId: prefilledHouseholdId || '',
        petId: prefilledPetId || '',
        date: prefilledDate || new Date().toISOString().split('T')[0],
      });
      setSelectedContact(undefined);
      setError(null);
      onClose();
    }
  };

  const availablePets = currentHouseholdDetail?.pets || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Transport Request</DialogTitle>
          <DialogDescription>
            Schedule a pickup or drop-off for a pet. Contact information will be shared with the driver.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Household Selection */}
          {!prefilledHouseholdId && (
            <div className="space-y-2">
              <Label htmlFor="householdId">
                Household <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.householdId}
                onValueChange={(value) => handleChange('householdId', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="householdId">
                  <SelectValue placeholder="Select household" />
                </SelectTrigger>
                <SelectContent>
                  {households.map(household => (
                    <SelectItem key={household.id} value={household.id}>
                      {household.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Contact Selection - Shows all contacts with their details */}
          {formData.householdId && (
            <ContactSelector
              householdId={formData.householdId}
              value={formData.contactId}
              onChange={handleContactChange}
              label="Contact Person"
              placeholder="Select who to contact"
              required
              disabled={isSubmitting}
              showContactDetails
            />
          )}

          {/* Pet Selection */}
          {formData.householdId && (
            <div className="space-y-2">
              <Label htmlFor="petId">
                Pet <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.petId}
                onValueChange={(value) => handleChange('petId', value)}
                disabled={isSubmitting || availablePets.length === 0}
              >
                <SelectTrigger id="petId">
                  <SelectValue placeholder="Select pet" />
                </SelectTrigger>
                <SelectContent>
                  {availablePets.map(pet => (
                    <SelectItem key={pet.id} value={pet.id}>
                      <div className="flex items-center gap-2">
                        <Dog className="h-4 w-4" />
                        {pet.name}
                        {pet.breed && <span className="text-slate-500">({pet.breed})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Transport Type */}
            <div className="space-y-2">
              <Label htmlFor="type">
                Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: TransportType) => handleChange('type', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pickup</SelectItem>
                  <SelectItem value="dropoff">Drop-off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.reason}
                onValueChange={(value: TransportReason) => handleChange('reason', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daycare">Daycare</SelectItem>
                  <SelectItem value="grooming">Grooming</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Time Window */}
            <div className="space-y-2">
              <Label htmlFor="timeWindow">
                Time Window <span className="text-red-500">*</span>
              </Label>
              <Input
                id="timeWindow"
                value={formData.timeWindow}
                onChange={(e) => handleChange('timeWindow', e.target.value)}
                placeholder="e.g., 07:00 - 08:30"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Pickup Address */}
          <div className="space-y-2">
            <Label htmlFor="pickupAddress">
              {formData.type === 'pickup' ? 'Pickup' : 'Drop-off'} Address{' '}
              <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="pickupAddress"
                value={formData.pickupAddress}
                onChange={(e) => handleChange('pickupAddress', e.target.value)}
                placeholder="Full address including postcode"
                className="pl-10"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Special Instructions</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Gate codes, parking instructions, pet handling notes..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Info about contact sharing */}
          {selectedContact && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                Contact details for {selectedContact.first_name} {selectedContact.last_name} will be shared with the driver for this transport request.
              </AlertDescription>
            </Alert>
          )}

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
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? 'Creating Request...' : 'Create Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
