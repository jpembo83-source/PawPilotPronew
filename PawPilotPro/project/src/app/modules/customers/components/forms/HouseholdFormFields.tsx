// Shared household form fields — extracted from CreateHouseholdPage so the
// onboarding wizard and the standalone page render the exact same form.

import type { HouseholdStatus } from '../../types';

export interface HouseholdFormData {
  name: string;
  external_id: string;
  preferred_location_id: string;
  notes: string;
  status: HouseholdStatus;
  vip: boolean;
}

export const initialHouseholdFormData: HouseholdFormData = {
  name: '',
  external_id: '',
  preferred_location_id: '',
  notes: '',
  status: 'active',
  vip: false,
};

export function validateHouseholdForm(formData: HouseholdFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.name.trim()) {
    errors.name = 'Household name is required';
  }

  return errors;
}

export function buildHouseholdPayload(formData: HouseholdFormData) {
  return {
    ...formData,
    name: formData.name.trim(),
    external_id: formData.external_id.trim() || undefined,
    preferred_location_id: formData.preferred_location_id || undefined,
    notes: formData.notes.trim() || undefined,
  };
}

interface HouseholdFormFieldsProps {
  formData: HouseholdFormData;
  errors: Record<string, string>;
  onChange: (field: keyof HouseholdFormData, value: string | boolean) => void;
  locations: Array<{ id: string; name: string }>;
}

export function HouseholdFormFields({ formData, errors, onChange, locations }: HouseholdFormFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Household Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          Household Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => onChange('name', e.target.value)}
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
          onChange={(e) => onChange('external_id', e.target.value)}
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
          onChange={(e) => onChange('preferred_location_id', e.target.value)}
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
          onChange={(e) => onChange('status', e.target.value)}
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
            onChange={(e) => onChange('vip', e.target.checked)}
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
          onChange={(e) => onChange('notes', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Any additional information about this household"
          rows={4}
        />
      </div>
    </div>
  );
}
