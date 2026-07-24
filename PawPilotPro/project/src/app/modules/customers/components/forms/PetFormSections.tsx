// Shared pet form sections — extracted from CreatePetModal so the onboarding
// wizard and the modal render the exact same fields. The modal's "Core
// Information" group is split into Essential (name/breed/sex/DOB) and
// Physical (weight/colour/microchip/neutered) so the wizard can surface the
// essentials and collapse the rest; the modal renders both back to back.

import { Badge } from '../../../../components/ui/badge';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import type { Pet, PetSex } from '../../types';
import { BreedCombobox } from './BreedCombobox';

export interface PetFormData {
  name: string;
  breed: string;
  sex: PetSex;
  date_of_birth: string;
  microchip: string;
  weight_kg: string;
  colour: string;
  neutered_status: 'spayed' | 'castrated' | 'none' | '';
  address_line1: string;
  address_line2: string;
  address_city: string;
  address_postcode: string;
  address_country: string;
  feeding_instructions: string;
  allergies: string;
  medication: string;
  behaviour_notes: string;
  medical_notes: string;
  vet_name: string;
  vet_phone: string;
  vet_address: string;
  daycare_enrolled: boolean;
  grooming_enrolled: boolean;
  transport_enrolled: boolean;
  overnights_enrolled: boolean;
}

export const initialPetFormData: PetFormData = {
  name: '',
  breed: '',
  sex: 'unknown',
  date_of_birth: '',
  microchip: '',
  weight_kg: '',
  colour: '',
  neutered_status: '',
  address_line1: '',
  address_line2: '',
  address_city: '',
  address_postcode: '',
  address_country: 'United Kingdom',
  feeding_instructions: '',
  allergies: '',
  medication: '',
  behaviour_notes: '',
  medical_notes: '',
  vet_name: '',
  vet_phone: '',
  vet_address: '',
  daycare_enrolled: true,
  grooming_enrolled: true,
  transport_enrolled: true,
  overnights_enrolled: true,
};

export function buildPetPayload(formData: PetFormData): Partial<Pet> {
  const payload: Partial<Pet> = {
    name: formData.name.trim(),
    breed: formData.breed.trim() || undefined,
    sex: formData.sex,
    date_of_birth: formData.date_of_birth || undefined,
    microchip: formData.microchip.trim() || undefined,
    weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : undefined,
    colour: formData.colour.trim() || undefined,
    neutered_status: formData.neutered_status || undefined,
    feeding_instructions: formData.feeding_instructions.trim() || undefined,
    allergies: formData.allergies.trim() || undefined,
    behaviour_notes: formData.behaviour_notes.trim() || undefined,
    medical_notes: formData.medical_notes.trim() || undefined,
    vet_name: formData.vet_name.trim() || undefined,
    vet_phone: formData.vet_phone.trim() || undefined,
    vet_address: formData.vet_address.trim() || undefined,
    daycare_enrolled: formData.daycare_enrolled,
    grooming_enrolled: formData.grooming_enrolled,
    transport_enrolled: formData.transport_enrolled,
    overnights_enrolled: formData.overnights_enrolled,
    active: true,
  };

  // Add address if any field is filled
  if (formData.address_line1 || formData.address_city || formData.address_postcode) {
    payload.address = {
      line1: formData.address_line1.trim() || undefined,
      line2: formData.address_line2.trim() || undefined,
      city: formData.address_city.trim() || undefined,
      postcode: formData.address_postcode.trim() || undefined,
      country: formData.address_country.trim() || undefined,
    };
  }

  return payload;
}

export interface PetSectionProps {
  formData: PetFormData;
  onChange: (field: keyof PetFormData, value: string | boolean) => void;
}

export function PetEssentialFields({ formData, onChange }: PetSectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Pet Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g., Max, Bella"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="breed">Breed</Label>
          <BreedCombobox
            id="breed"
            value={formData.breed}
            onChange={(value) => onChange('breed', value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sex">Sex</Label>
          <Select
            value={formData.sex}
            onValueChange={(value) => onChange('sex', value)}
          >
            <SelectTrigger>
              <SelectValue />
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
            onChange={(e) => onChange('date_of_birth', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function PetPhysicalFields({ formData, onChange }: PetSectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="weight_kg">Weight (kg)</Label>
          <Input
            id="weight_kg"
            type="number"
            step="0.1"
            min="0"
            value={formData.weight_kg}
            onChange={(e) => onChange('weight_kg', e.target.value)}
            placeholder="e.g., 25.5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="colour">Colour/Markings</Label>
          <Input
            id="colour"
            value={formData.colour}
            onChange={(e) => onChange('colour', e.target.value)}
            placeholder="e.g., Golden, Black with white chest"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="microchip">Microchip Number</Label>
        <Input
          id="microchip"
          value={formData.microchip}
          onChange={(e) => onChange('microchip', e.target.value)}
          placeholder="e.g., 123456789012345"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="neutered_status">Neutered/Spayed Status</Label>
        <Select
          value={formData.neutered_status}
          onValueChange={(value) => onChange('neutered_status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {formData.sex === 'female' && (
              <>
                <SelectItem value="spayed">Spayed</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </>
            )}
            {formData.sex === 'male' && (
              <>
                <SelectItem value="castrated">Castrated</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </>
            )}
            {formData.sex === 'unknown' && (
              <>
                <SelectItem value="spayed">Spayed</SelectItem>
                <SelectItem value="castrated">Castrated</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function PetAddressFields({ formData, onChange }: PetSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Pet Address</h3>
      <p className="text-sm text-slate-600">
        Enter the pet's primary address (if different from household)
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address_line1">Address Line 1</Label>
          <Input
            id="address_line1"
            value={formData.address_line1}
            onChange={(e) => onChange('address_line1', e.target.value)}
            placeholder="Street address"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_line2">Address Line 2</Label>
          <Input
            id="address_line2"
            value={formData.address_line2}
            onChange={(e) => onChange('address_line2', e.target.value)}
            placeholder="Apartment, suite, unit, etc. (optional)"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address_city">City</Label>
            <Input
              id="address_city"
              value={formData.address_city}
              onChange={(e) => onChange('address_city', e.target.value)}
              placeholder="e.g., London"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_postcode">Postcode</Label>
            <Input
              id="address_postcode"
              value={formData.address_postcode}
              onChange={(e) => onChange('address_postcode', e.target.value)}
              placeholder="e.g., SW1A 1AA"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_country">Country</Label>
          <Input
            id="address_country"
            value={formData.address_country}
            onChange={(e) => onChange('address_country', e.target.value)}
            placeholder="United Kingdom"
          />
        </div>
      </div>
    </div>
  );
}

export function PetCareFields({ formData, onChange }: PetSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Care Instructions</h3>

      <div className="space-y-2">
        <Label htmlFor="feeding_instructions">Feeding Instructions</Label>
        <Textarea
          id="feeding_instructions"
          value={formData.feeding_instructions}
          onChange={(e) => onChange('feeding_instructions', e.target.value)}
          placeholder="e.g., 2 cups of dry food twice daily, no treats after 6pm"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies</Label>
        <Textarea
          id="allergies"
          value={formData.allergies}
          onChange={(e) => onChange('allergies', e.target.value)}
          placeholder="e.g., Allergic to chicken, wheat sensitivity"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="behaviour_notes">
          Behaviour Notes
          <Badge variant="outline" className="ml-2 text-xs">Staff Only</Badge>
        </Label>
        <Textarea
          id="behaviour_notes"
          value={formData.behaviour_notes}
          onChange={(e) => onChange('behaviour_notes', e.target.value)}
          placeholder="e.g., Nervous around loud noises, plays well with other dogs"
          rows={2}
        />
        <p className="text-xs text-slate-500">
          Internal notes about pet behaviour, not visible to customers
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="medical_notes">
          Medical Notes
          <Badge variant="outline" className="ml-2 text-xs">Staff Only</Badge>
        </Label>
        <Textarea
          id="medical_notes"
          value={formData.medical_notes}
          onChange={(e) => onChange('medical_notes', e.target.value)}
          placeholder="e.g., Hip dysplasia, takes medication for arthritis"
          rows={2}
        />
        <p className="text-xs text-slate-500">
          Internal medical information, not visible to customers
        </p>
      </div>
    </div>
  );
}

export function PetVetFields({ formData, onChange }: PetSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Veterinary Details</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vet_name">Vet Name/Practice</Label>
          <Input
            id="vet_name"
            value={formData.vet_name}
            onChange={(e) => onChange('vet_name', e.target.value)}
            placeholder="e.g., Riverside Veterinary Clinic"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vet_phone">Vet Phone</Label>
          <Input
            id="vet_phone"
            type="tel"
            value={formData.vet_phone}
            onChange={(e) => onChange('vet_phone', e.target.value)}
            placeholder="e.g., 01234 567890"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vet_address">Vet Address</Label>
        <Textarea
          id="vet_address"
          value={formData.vet_address}
          onChange={(e) => onChange('vet_address', e.target.value)}
          placeholder="Full address of veterinary practice"
          rows={2}
        />
      </div>
    </div>
  );
}

export function PetEnrolmentFields({ formData, onChange }: PetSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Service Enrolment</h3>
      <p className="text-sm text-slate-600">
        Select which services this pet can be booked for. All services are enabled by default.
      </p>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="daycare_enrolled"
            checked={formData.daycare_enrolled}
            onCheckedChange={(checked) => onChange('daycare_enrolled', !!checked)}
          />
          <Label
            htmlFor="daycare_enrolled"
            className="text-sm font-normal cursor-pointer"
          >
            Daycare Eligible
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="grooming_enrolled"
            checked={formData.grooming_enrolled}
            onCheckedChange={(checked) => onChange('grooming_enrolled', !!checked)}
          />
          <Label
            htmlFor="grooming_enrolled"
            className="text-sm font-normal cursor-pointer"
          >
            Grooming Eligible
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="transport_enrolled"
            checked={formData.transport_enrolled}
            onCheckedChange={(checked) => onChange('transport_enrolled', !!checked)}
          />
          <Label
            htmlFor="transport_enrolled"
            className="text-sm font-normal cursor-pointer"
          >
            Transport Eligible
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="overnights_enrolled"
            checked={formData.overnights_enrolled}
            onCheckedChange={(checked) => onChange('overnights_enrolled', !!checked)}
          />
          <Label
            htmlFor="overnights_enrolled"
            className="text-sm font-normal cursor-pointer"
          >
            Overnights Eligible
          </Label>
        </div>
      </div>
    </div>
  );
}
