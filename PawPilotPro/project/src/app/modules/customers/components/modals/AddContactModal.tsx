import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useCustomerStore } from '../../store';
import { useSettingsStore } from '../../../settings/store';
import { toast } from 'sonner';
import type { ContactMethod } from '../../types';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  householdId: string;
  onContactAdded?: () => void;
}

interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  preferred_contact_method: ContactMethod;
  is_primary: boolean;
  is_emergency_contact: boolean;
  emergency_contact_relationship: string;
  marketing_consent: boolean;
  sms_consent: boolean;
  email_consent: boolean;
  address_line1: string;
  address_line2: string;
  address_city: string;
  address_postcode: string;
  address_country: string;
}

const initialFormData: ContactFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  preferred_contact_method: 'email',
  is_primary: false,
  is_emergency_contact: false,
  emergency_contact_relationship: '',
  marketing_consent: false,
  sms_consent: false,
  email_consent: false,
  address_line1: '',
  address_line2: '',
  address_city: '',
  address_postcode: '',
  address_country: '',
};

export function AddContactModal({ open, onClose, householdId, onContactAdded }: AddContactModalProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createContact, fetchHouseholdDetail } = useCustomerStore();
  const { organisation } = useSettingsStore();

  const handleChange = (field: keyof ContactFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.email && !formData.phone) {
      setError('At least one contact method (email or phone) is required');
      return false;
    }
    if (formData.email && !isValidEmail(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.is_emergency_contact && !formData.emergency_contact_relationship.trim()) {
      setError('Emergency contact relationship is required');
      return false;
    }
    return true;
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      const newContact = await createContact(householdId, {
        ...formData,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        emergency_contact_relationship: formData.emergency_contact_relationship || undefined,
      });

      // Refresh the household detail to get updated contacts
      await fetchHouseholdDetail(householdId);

      toast.success(`Contact added: ${formData.first_name} ${formData.last_name}`);
      
      // Reset form
      setFormData(initialFormData);
      
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
      setFormData(initialFormData);
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
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  placeholder="John"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  placeholder="Smith"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john.smith@example.com"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder={`${organisation.dialCode} ...`}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_contact_method">Preferred Contact Method</Label>
              <Select
                value={formData.preferred_contact_method}
                onValueChange={(value: ContactMethod) => handleChange('preferred_contact_method', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="preferred_contact_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Contact Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="is_primary" className="font-medium cursor-pointer">
                    Primary Contact
                  </Label>
                  <p className="text-sm text-slate-600">
                    This is the main contact for the household
                  </p>
                </div>
                <Switch
                  id="is_primary"
                  checked={formData.is_primary}
                  onCheckedChange={(checked) => handleChange('is_primary', checked)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="is_emergency_contact" className="font-medium cursor-pointer">
                    Emergency Contact
                  </Label>
                  <p className="text-sm text-slate-600">
                    Can be contacted in case of emergency
                  </p>
                </div>
                <Switch
                  id="is_emergency_contact"
                  checked={formData.is_emergency_contact}
                  onCheckedChange={(checked) => handleChange('is_emergency_contact', checked)}
                  disabled={isSubmitting}
                />
              </div>

              {formData.is_emergency_contact && (
                <div className="space-y-2 pl-3">
                  <Label htmlFor="emergency_contact_relationship">
                    Relationship <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="emergency_contact_relationship"
                    value={formData.emergency_contact_relationship}
                    onChange={(e) => handleChange('emergency_contact_relationship', e.target.value)}
                    placeholder="e.g., Spouse, Friend, Neighbor"
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Communication Preferences */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">Communication Preferences</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="email_consent" className="font-medium cursor-pointer">
                    Email Communications
                  </Label>
                  <p className="text-sm text-slate-600">
                    Receive booking confirmations and updates via email
                  </p>
                </div>
                <Switch
                  id="email_consent"
                  checked={formData.email_consent}
                  onCheckedChange={(checked) => handleChange('email_consent', checked)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="sms_consent" className="font-medium cursor-pointer">
                    SMS Notifications
                  </Label>
                  <p className="text-sm text-slate-600">
                    Receive text message notifications and reminders
                  </p>
                </div>
                <Switch
                  id="sms_consent"
                  checked={formData.sms_consent}
                  onCheckedChange={(checked) => handleChange('sms_consent', checked)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="marketing_consent" className="font-medium cursor-pointer">
                    Marketing Communications
                  </Label>
                  <p className="text-sm text-slate-600">
                    Receive promotional offers and newsletters
                  </p>
                </div>
                <Switch
                  id="marketing_consent"
                  checked={formData.marketing_consent}
                  onCheckedChange={(checked) => handleChange('marketing_consent', checked)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-sm text-slate-700">Address</h3>
              {formData.is_primary && (
                <p className="text-xs text-amber-600 font-medium">
                  Primary contact address is used for transport services
                </p>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input
                  id="address_line1"
                  value={formData.address_line1}
                  onChange={(e) => handleChange('address_line1', e.target.value)}
                  placeholder="123 Main Street"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.address_line2}
                  onChange={(e) => handleChange('address_line2', e.target.value)}
                  placeholder="Apartment, suite, etc. (optional)"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_city">City</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) => handleChange('address_city', e.target.value)}
                    placeholder="City"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_postcode">Postcode</Label>
                  <Input
                    id="address_postcode"
                    value={formData.address_postcode}
                    onChange={(e) => handleChange('address_postcode', e.target.value)}
                    placeholder="Postcode"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_country">Country</Label>
                <Input
                  id="address_country"
                  value={formData.address_country}
                  onChange={(e) => handleChange('address_country', e.target.value)}
                  placeholder="Country"
                  disabled={isSubmitting}
                />
              </div>
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
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? 'Adding Contact...' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}