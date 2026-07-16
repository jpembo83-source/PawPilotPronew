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
  House,
  MapPin,
  CalendarBlank,
  Clock,
  User,
  Warning,
  CircleNotch,
  CheckCircle,
  ArrowRight,
  Truck
} from '@phosphor-icons/react';

interface CreateTransportJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultLocationId?: string;
  onJobCreated?: () => void;
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

const STEPS = ['Select Household', 'Select Pet', 'Transport Details', 'Review'];

export function CreateTransportJobDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultLocationId,
  onJobCreated
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            New Transport Job
          </DialogTitle>
          <DialogDescription>
            Create a transport job for a customer's pet
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  index < currentStep
                    ? 'bg-green-100 text-green-700'
                    : index === currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {index < currentStep ? <CheckCircle className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  index === currentStep ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {step}
              </span>
              {index < STEPS.length - 1 && (
                <CaretRight className="h-4 w-4 text-slate-300 ml-2" />
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <Warning className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-auto py-4">
          {/* Step 1: Select Household */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Search for Household</Label>
                <div className="relative mt-1">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by household name, contact name, email, phone, or pet name..."
                    className="pl-9"
                    autoFocus
                  />
                  {isSearching && (
                    <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                  )}
                </div>
              </div>

              {/* MagnifyingGlass Results */}
              {searchResults.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-96 overflow-auto">
                  {searchResults.map((household) => (
                    <button
                      key={household.id}
                      onClick={() => handleSelectHousehold(household)}
                      className="w-full p-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <House className="h-4 w-4 text-slate-400" />
                            <h4 className="font-semibold text-slate-900">{household.name}</h4>
                          </div>
                          
                          {household.address && (
                            <p className="text-sm text-slate-600 flex items-center gap-1 mb-2">
                              <MapPin className="h-3 w-3" />
                              {household.address}
                            </p>
                          )}

                          {/* Contacts */}
                          {household.contacts && household.contacts.length > 0 && (
                            <div className="text-xs text-slate-500 mb-2">
                              {household.contacts.slice(0, 2).map((contact) => (
                                <div key={contact.id}>
                                  {contact.first_name} {contact.last_name}
                                  {contact.phone && ` • ${contact.phone}`}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Pets */}
                          {household.pets && household.pets.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <Dog className="h-3 w-3 text-slate-400" />
                              {household.pets.map((pet) => (
                                <Badge key={pet.id} variant="secondary" className="text-xs">
                                  {pet.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <CaretRight className="h-5 w-5 text-slate-300 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Dog className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No households found matching "{searchQuery}"</p>
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-8 text-slate-500">
                  <MagnifyingGlass className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">Start typing to search for a household</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Pet */}
          {currentStep === 1 && selectedHousehold && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Selected Household:</div>
                <div className="font-semibold text-slate-900">{selectedHousehold.name}</div>
                {selectedHousehold.address && (
                  <div className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedHousehold.address}
                  </div>
                )}
              </div>

              <div>
                <Label>Select Pet</Label>
                <div className="grid grid-cols-1 gap-3 mt-2">
                  {selectedHousehold.pets && selectedHousehold.pets.length > 0 ? (
                    selectedHousehold.pets.map((pet) => (
                      <button
                        key={pet.id}
                        onClick={() => handleSelectPet(pet)}
                        className="border-2 border-slate-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                      >
                        <div className="flex items-start gap-3">
                          {pet.photo_url ? (
                            <img
                              src={pet.photo_url}
                              alt={pet.name}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                              <Dog className="h-8 w-8 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 mb-1">{pet.name}</h4>
                            
                            {/* Flags */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {pet.behaviour_flags && pet.behaviour_flags.length > 0 && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                  Behaviour flags
                                </Badge>
                              )}
                              {pet.medical_flags && pet.medical_flags.length > 0 && (
                                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                  Medical flags
                                </Badge>
                              )}
                            </div>

                            {pet.transport_notes && (
                              <p className="text-xs text-slate-600 italic">
                                Transport notes: {pet.transport_notes}
                              </p>
                            )}
                          </div>
                          <CaretRight className="h-5 w-5 text-slate-300 shrink-0" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Dog className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No pets found for this household</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Transport Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start gap-3">
                  {selectedPet?.photo_url ? (
                    <img
                      src={selectedPet.photo_url}
                      alt={selectedPet.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center">
                      <Dog className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-slate-900">{selectedPet?.name}</div>
                    <div className="text-sm text-slate-600">{selectedHousehold?.name}</div>
                  </div>
                </div>
              </div>

              {/* Service Date */}
              <div>
                <Label htmlFor="serviceDate">Service Date</Label>
                <div className="relative mt-1">
                  <CalendarBlank className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="serviceDate"
                    type="date"
                    value={formData.service_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, service_date: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Pick-up Address */}
              <div className="space-y-2">
                <Label>Pick-up Address</Label>
                
                {/* Address Type Selector */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, pickup_type: 'location', address_pickup: '' }))}
                    className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.pickup_type === 'location'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      pickup_type: 'other',
                      pickup_location_id: '',
                      address_pickup: selectedHousehold?.address || '' 
                    }))}
                    className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.pickup_type === 'other'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    Other
                  </button>
                </div>

                {/* Location Dropdown */}
                {formData.pickup_type === 'location' && (
                  <select
                    value={formData.pickup_location_id}
                    onChange={(e) => {
                      const selectedLoc = locations.find(l => l.id === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        pickup_location_id: e.target.value,
                        // Store the real street address so the driver's
                        // navigation works; fall back to the name only if the
                        // location has no address on file.
                        address_pickup: selectedLoc?.address || selectedLoc?.name || ''
                      }));
                    }}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm"
                  >
                    <option value="">Select a location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Custom Address Input */}
                {formData.pickup_type === 'other' && (
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <textarea
                      value={formData.address_pickup}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_pickup: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-300 text-sm resize-none"
                      rows={2}
                      placeholder="Enter pick-up address"
                    />
                  </div>
                )}
              </div>

              {/* Drop-off Address */}
              <div className="space-y-2">
                <Label>Drop-off Address</Label>
                
                {/* Address Type Selector */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, dropoff_type: 'location', address_dropoff: '' }))}
                    className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.dropoff_type === 'location'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      dropoff_type: 'other',
                      dropoff_location_id: '',
                      address_dropoff: selectedHousehold?.address || '' 
                    }))}
                    className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.dropoff_type === 'other'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    Other
                  </button>
                </div>

                {/* Location Dropdown */}
                {formData.dropoff_type === 'location' && (
                  <select
                    value={formData.dropoff_location_id}
                    onChange={(e) => {
                      const selectedLoc = locations.find(l => l.id === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        dropoff_location_id: e.target.value,
                        address_dropoff: selectedLoc?.address || selectedLoc?.name || ''
                      }));
                    }}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm"
                  >
                    <option value="">Select a location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Custom Address Input */}
                {formData.dropoff_type === 'other' && (
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <textarea
                      value={formData.address_dropoff}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_dropoff: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-300 text-sm resize-none"
                      rows={2}
                      placeholder="Enter drop-off address"
                    />
                  </div>
                )}
              </div>

              {/* Time Window */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timeStart">Time Window Start (optional)</Label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="timeStart"
                      type="time"
                      value={formData.time_window_start}
                      onChange={(e) => setFormData(prev => ({ ...prev, time_window_start: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="timeEnd">Time Window End (optional)</Label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="timeEnd"
                      type="time"
                      value={formData.time_window_end}
                      onChange={(e) => setFormData(prev => ({ ...prev, time_window_end: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-slate-300 text-sm resize-none"
                  rows={3}
                  placeholder="Add any special instructions or notes..."
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Driver Assignment Info Banner */}
              {activeDriverCount === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Warning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-900 mb-1">No Drivers Configured</div>
                      <p className="text-sm text-amber-700">
                        No active drivers are configured for this location. The job will be created without a driver assignment.
                        You can assign a driver later once they are configured.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeDriverCount === 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-blue-900 mb-1">Auto-Assignment Enabled</div>
                      <p className="text-sm text-blue-700">
                        This job will be automatically assigned to {activeDrivers && activeDrivers[0]?.first_name} {activeDrivers && activeDrivers[0]?.last_name}
                        {activeDrivers && activeDrivers[0]?.role && ` (${activeDrivers[0].role})`} - the sole active driver for this location.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeDriverCount && activeDriverCount >= 2 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Warning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-900 mb-1">Driver Assignment Required</div>
                      <p className="text-sm text-amber-700">
                        {activeDriverCount} drivers are available. This job will need a driver assignment after creation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Household & Pet */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Customer & Pet
                </h4>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start gap-3 mb-3">
                    {selectedPet?.photo_url ? (
                      <img
                        src={selectedPet.photo_url}
                        alt={selectedPet.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center">
                        <Dog className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">{selectedPet?.name}</div>
                      <div className="text-sm text-slate-600">{selectedHousehold?.name}</div>
                      {selectedHousehold?.address && (
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {selectedHousehold.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transport Details */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Transport Details
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-600">Location:</span>
                    <span className="font-medium text-slate-900">
                      {locations.find((l) => l.id === formData.location_id)?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-600">Date:</span>
                    <span className="font-medium text-slate-900">
                      {format(new Date(formData.service_date), 'EEE, MMM d, yyyy')}
                    </span>
                  </div>

                  {formData.address_pickup && (
                    <div className="py-2 border-b border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Pick-up Address:</div>
                      <div className="text-sm font-medium text-slate-900">{formData.address_pickup}</div>
                    </div>
                  )}

                  {formData.address_dropoff && (
                    <div className="py-2 border-b border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Drop-off Address:</div>
                      <div className="text-sm font-medium text-slate-900">{formData.address_dropoff}</div>
                    </div>
                  )}

                  {(formData.time_window_start || formData.time_window_end) && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-600">Time Window:</span>
                      <span className="font-medium text-slate-900">
                        {formData.time_window_start || '--:--'} - {formData.time_window_end || '--:--'}
                      </span>
                    </div>
                  )}

                  {formData.notes && (
                    <div className="py-2">
                      <div className="text-sm text-slate-600 mb-1">Notes:</div>
                      <div className="text-sm text-slate-700 bg-slate-50 rounded p-2">
                        {formData.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isSubmitting}
              >
                <CaretLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>

            {currentStep < 2 && (
              <Button
                disabled={
                  (currentStep === 0 && !selectedHousehold) ||
                  (currentStep === 1 && !selectedPet)
                }
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                Next
                <CaretRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                disabled={!canProceedToReview()}
                onClick={() => setCurrentStep(3)}
              >
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {currentStep === 3 && (
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
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}