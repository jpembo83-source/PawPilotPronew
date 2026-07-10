// Shared contact form sections — extracted from AddContactModal so the
// onboarding wizard and the modal render the exact same fields. Each section
// matches one of the modal's original headed groups.

import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { useSettingsStore } from '../../../settings/store';
import type { ContactMethod } from '../../types';

export interface ContactFormData {
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

export const initialContactFormData: ContactFormData = {
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Returns the first validation error, or null when the form is valid. */
export function validateContactForm(formData: ContactFormData): string | null {
  if (!formData.first_name.trim()) {
    return 'First name is required';
  }
  if (!formData.last_name.trim()) {
    return 'Last name is required';
  }
  if (!formData.email && !formData.phone) {
    return 'At least one contact method (email or phone) is required';
  }
  if (formData.email && !isValidEmail(formData.email)) {
    return 'Please enter a valid email address';
  }
  if (formData.is_emergency_contact && !formData.emergency_contact_relationship.trim()) {
    return 'Emergency contact relationship is required';
  }
  return null;
}

export function buildContactPayload(formData: ContactFormData) {
  return {
    ...formData,
    email: formData.email || undefined,
    phone: formData.phone || undefined,
    emergency_contact_relationship: formData.emergency_contact_relationship || undefined,
  };
}

export interface ContactSectionProps {
  formData: ContactFormData;
  onChange: (field: keyof ContactFormData, value: string | boolean) => void;
  disabled?: boolean;
}

export function ContactBasicFields({ formData, onChange, disabled }: ContactSectionProps) {
  const { organisation } = useSettingsStore();

  return (
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
            onChange={(e) => onChange('first_name', e.target.value)}
            placeholder="John"
            disabled={disabled}
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
            onChange={(e) => onChange('last_name', e.target.value)}
            placeholder="Smith"
            disabled={disabled}
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
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="john.smith@example.com"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder={`${organisation.dialCode} ...`}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferred_contact_method">Preferred Contact Method</Label>
        <Select
          value={formData.preferred_contact_method}
          onValueChange={(value: ContactMethod) => onChange('preferred_contact_method', value)}
          disabled={disabled}
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
  );
}

export function ContactSettingsFields({ formData, onChange, disabled }: ContactSectionProps) {
  return (
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
            onCheckedChange={(checked) => onChange('is_primary', checked)}
            disabled={disabled}
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
            onCheckedChange={(checked) => onChange('is_emergency_contact', checked)}
            disabled={disabled}
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
              onChange={(e) => onChange('emergency_contact_relationship', e.target.value)}
              placeholder="e.g., Spouse, Friend, Neighbor"
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ContactConsentFields({ formData, onChange, disabled }: ContactSectionProps) {
  return (
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
            onCheckedChange={(checked) => onChange('email_consent', checked)}
            disabled={disabled}
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
            onCheckedChange={(checked) => onChange('sms_consent', checked)}
            disabled={disabled}
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
            onCheckedChange={(checked) => onChange('marketing_consent', checked)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export function ContactAddressFields({ formData, onChange, disabled }: ContactSectionProps) {
  return (
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
            onChange={(e) => onChange('address_line1', e.target.value)}
            placeholder="123 Main Street"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_line2">Address Line 2</Label>
          <Input
            id="address_line2"
            value={formData.address_line2}
            onChange={(e) => onChange('address_line2', e.target.value)}
            placeholder="Apartment, suite, etc. (optional)"
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address_city">City</Label>
            <Input
              id="address_city"
              value={formData.address_city}
              onChange={(e) => onChange('address_city', e.target.value)}
              placeholder="City"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_postcode">Postcode</Label>
            <Input
              id="address_postcode"
              value={formData.address_postcode}
              onChange={(e) => onChange('address_postcode', e.target.value)}
              placeholder="Postcode"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_country">Country</Label>
          <Input
            id="address_country"
            value={formData.address_country}
            onChange={(e) => onChange('address_country', e.target.value)}
            placeholder="Country"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
