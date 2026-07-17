/**
 * Create Transport Job Dialog - Multi-step flow
 * Production-grade customer search, pet selection, and transport details
 * British English throughout, tenant-isolated
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useSettingsStore } from '../../settings/store';
import { useTransportStore } from '../store';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '@/utils/supabase/authHeaders';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import {
  MagnifyingGlass,
  CaretRight,
  CaretLeft,
  Dog,
  CalendarBlank,
  Clock,
  Warning,
  CircleNotch,
  CheckCircle,
  Truck
} from '@phosphor-icons/react';

interface CreateTransportJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultLocationId?: string;
  onJobCreated?: () => void;
  /**
   * Pre-select a household and skip the search step (used when launching from
   * a household profile). Pets/contacts/address let the dialog jump straight
   * to pet selection.
   */
  prefillHousehold?: Household;
}

interface Household {
  id: string;
  name: string;
  primary_contact_id?: string;
  address?: string;
  pets?: Pet[];
  contacts?: Contact[];
}

interface Pet {
  id: string;
  name: string;
  photo_url?: string;
  household_id: string;
  behaviour_flags?: string[];
  medical_flags?: string[];
  transport_notes?: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  relationship: string;
}

type TransportDirection = 'pickup' | 'dropoff' | 'roundtrip';

// Named to avoid colliding with the DOM built-in FormData, which this form
// state previously (and silently) resolved to.
interface TransportJobFormState {
  location_id: string;
  service_date: string;
  address_pickup: string;
  address_dropoff: string;
  pickup_type: 'location' | 'other';
  dropoff_type: 'location' | 'other';
  pickup_location_id: string;
  dropoff_location_id: string;
  time_window_start: string;
  time_window_end: string;
  notes: string;
}

// No step-indicator strip: like the daycare booking dialog, the header's
// title/description change per step and each step has a small Back link.

export function CreateTransportJobDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultLocationId,
  onJobCreated,
  prefillHousehold
}: CreateTransportJobDialogProps) {
  const { locations } = useSettingsStore();
  const { createJob, fetchActiveDrivers, activeDriverCount, activeDrivers } = useTransportStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MagnifyingGlass state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Household[]>([]);

  // Form state
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  
  // Transport details form data
  const [formData, setFormData] = useState<TransportJobFormState>({
    location_id: defaultLocationId || '',
    service_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    address_pickup: '',
    address_dropoff: '',
    pickup_type: 'other',
    dropoff_type: 'location',
    pickup_location_id: '',
    dropoff_location_id: '',
    time_window_start: '',
    time_window_end: '',
    notes: '',
  });

  // Initialize location
  useEffect(() => {
    if (!formData.location_id && locations.length > 0) {
      setFormData(prev => ({ ...prev, location_id: locations[0].id }));
    }
  }, [locations, formData.location_id]);

  // When launched with a household pre-selected (e.g. from a household
  // profile), skip the search step and start at pet selection.
  useEffect(() => {
    if (open && prefillHousehold && !selectedHousehold) {
      setSelectedHousehold(prefillHousehold);
      setCurrentStep(1);
    }
  }, [open, prefillHousehold, selectedHousehold]);

  // Fetch active drivers when location changes
  useEffect(() => {
    if (formData.location_id) {
      fetchActiveDrivers(formData.location_id);
    }
  }, [formData.location_id, fetchActiveDrivers]);

  // Auto-populate addresses when household selected
  useEffect(() => {
    if (selectedHousehold?.address && formData.pickup_type === 'other' && !formData.address_pickup) {
      setFormData(prev => ({ ...prev, address_pickup: selectedHousehold.address || '' }));
    }
  }, [selectedHousehold]);

  // Customer search
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare/search-customers?q=${encodeURIComponent(query)}`;


      const response = await fetch(url, {
        headers: await getAuthHeaders(),
      });


      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Transport] Error response:', errorData);
        throw new Error(errorData.error || 'Failed to search customers');
      }

      const data = await response.json();
      
      // Transform search results to match our Household interface
      // The API returns an array directly, not wrapped in a results property
      const transformedResults: Household[] = (Array.isArray(data) ? data : []).map((result: any) => {
        // Build address from contact fields
        const primaryContact = result.contacts?.[0];
        let address = '';
        if (primaryContact) {
          const parts = [
            primaryContact.address_line1,
            primaryContact.address_line2,
            primaryContact.address_city,
            primaryContact.address_postcode,
            primaryContact.address_country
          ].filter(Boolean);
          address = parts.join(', ');
        }

        return {
          id: result.household_id,
          name: result.household_name,
          primary_contact_id: result.contacts?.[0]?.id,
          address: address,
          pets: result.pets || [],
          contacts: result.contacts || [],
        };
      });
      
      setSearchResults(transformedResults);
    } catch (err: any) {
      console.error('[Transport] Customer search error:', err);
      setError(err.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectHousehold = (household: Household) => {
    setSelectedHousehold(household);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentStep(1);
  };

  const handleSelectPet = (pet: Pet) => {
    setSelectedPet(pet);
    setCurrentStep(2);
  };

  const canProceedToReview = () => {
    if (!selectedHousehold || !selectedPet || !formData.service_date) {
      return false;
    }

    // At least one address must be filled
    return formData.address_pickup.trim() || formData.address_dropoff.trim();
  };

  const handleSubmit = async () => {
    if (!selectedHousehold || !selectedPet || !formData.service_date) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine direction based on addresses
      let direction: TransportDirection = 'roundtrip';
      if (formData.address_pickup && !formData.address_dropoff) {
        direction = 'pickup';
      } else if (!formData.address_pickup && formData.address_dropoff) {
        direction = 'dropoff';
      }

      // Auto-determine location based on selected pickup/dropoff locations
      let location_id = formData.location_id;
      if (!location_id) {
        // Try to get from pickup or dropoff location
        location_id = formData.pickup_location_id || formData.dropoff_location_id;
      }
      // Fallback to first location
      if (!location_id && locations.length > 0) {
        location_id = locations[0].id;
      }

      const payload = {
        location_id: location_id,
        service_date: formData.service_date,
        direction: direction,
        household_id: selectedHousehold.id,
        pet_id: selectedPet.id,
        address_pickup: formData.address_pickup || null,
        address_dropoff: formData.address_dropoff || null,
        time_window_start: formData.time_window_start || null,
        time_window_end: formData.time_window_end || null,
        notes: formData.notes || null,
      };


      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/transport/jobs`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      });


      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Transport] Error response:', errorData);
        throw new Error(errorData.error || 'Failed to create transport job');
      }

      const result = await response.json();

      // Success! Close dialog and show success message
      toast.success('Transport job created successfully');
      onOpenChange(false);
      
      // Refresh the jobs list if callback provided
      if (onJobCreated) {
        onJobCreated();
      }
    } catch (err: any) {
      console.error('Error creating transport job:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset all state
    setCurrentStep(0);
    setSelectedHousehold(null);
    setSelectedPet(null);
    setSearchQuery('');
    setSearchResults([]);
    setFormData({
      location_id: defaultLocationId || '',
      service_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      address_pickup: '',
      address_dropoff: '',
      pickup_type: 'other',
      dropoff_type: 'location',
      pickup_location_id: '',
      dropoff_location_id: '',
      time_window_start: '',
      time_window_end: '',
      notes: '',
    });
    setError(null);
    onOpenChange(false);
  };

  const stepDescription =
    currentStep === 0
      ? 'Type a household, contact, phone or pet name to search'
      : currentStep === 1
      ? `Select a pet from ${selectedHousehold?.name ?? 'the household'}`
      : currentStep === 2
      ? `Transport details for ${selectedPet?.name ?? 'the pet'}`
      : 'Review and create the job';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            New Transport Job
          </DialogTitle>
          <DialogDescription>{stepDescription}</DialogDescription>
        </DialogHeader>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <Warning className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Step 1: Live household search */}
        {currentStep === 0 && (
          <div className="space-y-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by household name, contact name, email, phone, or pet name..."
                className="pl-9"
              />
              {isSearching && (
                <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                {searchResults.map((household) => (
                  <button
                    key={household.id}
                    onClick={() => handleSelectHousehold(household)}
                    className="w-full flex items-start justify-between gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">{household.name}</p>
                      {household.address && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{household.address}</p>
                      )}
                      {household.pets && household.pets.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Dog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground truncate">
                            {household.pets.map((p) => p.name).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <CaretRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No households found matching "{searchQuery}"
              </p>
            )}
          </div>
        )}

        {/* Step 2: Select pet */}
        {currentStep === 1 && selectedHousehold && (
          <div className="space-y-3">
            {!prefillHousehold && (
              <button
                onClick={() => setCurrentStep(0)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <CaretLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}

            {selectedHousehold.pets && selectedHousehold.pets.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border border-border">
                {selectedHousehold.pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => handleSelectPet(pet)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    {pet.photo_url ? (
                      <img
                        src={pet.photo_url}
                        alt={pet.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-tint flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary-strong">{pet.name[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{pet.name}</p>
                      {pet.transport_notes && (
                        <p className="text-sm text-muted-foreground truncate italic">{pet.transport_notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {pet.behaviour_flags && pet.behaviour_flags.length > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Behaviour</Badge>
                      )}
                      {pet.medical_flags && pet.medical_flags.length > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs">Medical</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No pets found for this household</p>
            )}
          </div>
        )}

        {/* Step 3: Transport details */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <CaretLeft className="h-3.5 w-3.5" /> Back
            </button>

            {/* Pet summary */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {selectedPet?.photo_url ? (
                <img
                  src={selectedPet.photo_url}
                  alt={selectedPet.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-tint flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary-strong">{selectedPet?.name?.[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{selectedPet?.name}</p>
                <p className="text-sm text-muted-foreground truncate">{selectedHousehold?.name}</p>
              </div>
            </div>

            {/* Service Date */}
            <div className="space-y-1.5">
              <Label htmlFor="serviceDate">Service Date</Label>
              <div className="relative">
                <CalendarBlank className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="serviceDate"
                  type="date"
                  value={formData.service_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, service_date: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Pick-up Address */}
            <div className="space-y-1.5">
              <Label>Pick-up Address</Label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, pickup_type: 'location', address_pickup: '' }))}
                  className={`flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors ${
                    formData.pickup_type === 'location'
                      ? 'border-primary bg-primary-tint text-primary-strong'
                      : 'border-border hover:border-input text-muted-foreground'
                  }`}
                >
                  Location
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      pickup_type: 'other',
                      pickup_location_id: '',
                      address_pickup: selectedHousehold?.address || '',
                    }))
                  }
                  className={`flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors ${
                    formData.pickup_type === 'other'
                      ? 'border-primary bg-primary-tint text-primary-strong'
                      : 'border-border hover:border-input text-muted-foreground'
                  }`}
                >
                  Other
                </button>
              </div>

              {formData.pickup_type === 'location' && (
                <select
                  value={formData.pickup_location_id}
                  onChange={(e) => {
                    const selectedLoc = locations.find((l) => l.id === e.target.value);
                    setFormData((prev) => ({
                      ...prev,
                      pickup_location_id: e.target.value,
                      // Real street address so the driver's navigation works;
                      // name only as a fallback when none is on file.
                      address_pickup: selectedLoc?.address || selectedLoc?.name || '',
                    }));
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-input-background text-sm text-foreground"
                >
                  <option value="">Select a location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              )}

              {formData.pickup_type === 'other' && (
                <textarea
                  value={formData.address_pickup}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address_pickup: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-input-background text-sm text-foreground placeholder:text-muted-foreground resize-none"
                  rows={2}
                  placeholder="Enter pick-up address"
                />
              )}
            </div>

            {/* Drop-off Address */}
            <div className="space-y-1.5">
              <Label>Drop-off Address</Label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, dropoff_type: 'location', address_dropoff: '' }))}
                  className={`flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors ${
                    formData.dropoff_type === 'location'
                      ? 'border-primary bg-primary-tint text-primary-strong'
                      : 'border-border hover:border-input text-muted-foreground'
                  }`}
                >
                  Location
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      dropoff_type: 'other',
                      dropoff_location_id: '',
                      address_dropoff: selectedHousehold?.address || '',
                    }))
                  }
                  className={`flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors ${
                    formData.dropoff_type === 'other'
                      ? 'border-primary bg-primary-tint text-primary-strong'
                      : 'border-border hover:border-input text-muted-foreground'
                  }`}
                >
                  Other
                </button>
              </div>

              {formData.dropoff_type === 'location' && (
                <select
                  value={formData.dropoff_location_id}
                  onChange={(e) => {
                    const selectedLoc = locations.find((l) => l.id === e.target.value);
                    setFormData((prev) => ({
                      ...prev,
                      dropoff_location_id: e.target.value,
                      address_dropoff: selectedLoc?.address || selectedLoc?.name || '',
                    }));
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-input-background text-sm text-foreground"
                >
                  <option value="">Select a location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              )}

              {formData.dropoff_type === 'other' && (
                <textarea
                  value={formData.address_dropoff}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address_dropoff: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-input-background text-sm text-foreground placeholder:text-muted-foreground resize-none"
                  rows={2}
                  placeholder="Enter drop-off address"
                />
              )}
            </div>

            {/* Time Window */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="timeStart">Window start (optional)</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="timeStart"
                    type="time"
                    value={formData.time_window_start}
                    onChange={(e) => setFormData((prev) => ({ ...prev, time_window_start: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timeEnd">Window end (optional)</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="timeEnd"
                    type="time"
                    value={formData.time_window_end}
                    onChange={(e) => setFormData((prev) => ({ ...prev, time_window_end: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-input-background text-sm text-foreground placeholder:text-muted-foreground resize-none"
                rows={3}
                placeholder="Add any special instructions or notes..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button disabled={!canProceedToReview()} onClick={() => setCurrentStep(3)}>
                Review
                <CaretRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <CaretLeft className="h-3.5 w-3.5" /> Back
            </button>

            {/* Driver assignment banner */}
            {activeDriverCount === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <Warning className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  No active drivers for this location — the job will be created unassigned. You can
                  assign a driver later.
                </p>
              </div>
            )}
            {activeDriverCount === 1 && (
              <div className="bg-primary-tint border border-primary/20 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary-strong shrink-0 mt-0.5" />
                <p className="text-sm text-primary-strong">
                  Will be auto-assigned to {activeDrivers?.[0]?.first_name} {activeDrivers?.[0]?.last_name} —
                  the sole active driver for this location.
                </p>
              </div>
            )}
            {!!activeDriverCount && activeDriverCount >= 2 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <Warning className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  {activeDriverCount} drivers available — assign one after creating the job.
                </p>
              </div>
            )}

            {/* Pet summary */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {selectedPet?.photo_url ? (
                <img
                  src={selectedPet.photo_url}
                  alt={selectedPet.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-tint flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary-strong">{selectedPet?.name?.[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{selectedPet?.name}</p>
                <p className="text-sm text-muted-foreground truncate">{selectedHousehold?.name}</p>
              </div>
            </div>

            {/* Details summary */}
            <div className="rounded-lg border border-border divide-y divide-border text-sm">
              <div className="flex items-center justify-between gap-4 p-3">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-foreground text-right">
                  {locations.find((l) => l.id === formData.location_id)?.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 p-3">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground text-right">
                  {format(new Date(formData.service_date), 'EEE, MMM d, yyyy')}
                </span>
              </div>
              {formData.address_pickup && (
                <div className="flex items-start justify-between gap-4 p-3">
                  <span className="text-muted-foreground shrink-0">Pick-up</span>
                  <span className="font-medium text-foreground text-right">{formData.address_pickup}</span>
                </div>
              )}
              {formData.address_dropoff && (
                <div className="flex items-start justify-between gap-4 p-3">
                  <span className="text-muted-foreground shrink-0">Drop-off</span>
                  <span className="font-medium text-foreground text-right">{formData.address_dropoff}</span>
                </div>
              )}
              {(formData.time_window_start || formData.time_window_end) && (
                <div className="flex items-center justify-between gap-4 p-3">
                  <span className="text-muted-foreground">Time window</span>
                  <span className="font-medium text-foreground text-right">
                    {formData.time_window_start || '--:--'} – {formData.time_window_end || '--:--'}
                  </span>
                </div>
              )}
              {formData.notes && (
                <div className="p-3">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="text-foreground">{formData.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Transport Job
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
