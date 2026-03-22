import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useGroomingStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  ArrowLeft,
  Search,
  Scissors,
  Calendar,
  Clock,
  User,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SERVICE_TYPES, type GroomingServiceType } from '../types';
import { supabase } from '../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface SearchResult {
  household_id: string;
  household_name: string;
}

interface Pet {
  id: string;
  name: string;
  breed?: string;
  size?: string;
}

export function NewGroomingAppointment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { createAppointment, fetchGroomers, groomers } = useGroomingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [selectedHousehold, setSelectedHousehold] = useState<SearchResult | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoadingPets, setIsLoadingPets] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [serviceType, setServiceType] = useState<GroomingServiceType | ''>('');
  const [appointmentDate, setAppointmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [appointmentTime, setAppointmentTime] = useState('09:00');
  const [selectedLocationForAppt, setSelectedLocationForAppt] = useState(
    selectedLocationId !== 'ALL' ? selectedLocationId : ''
  );
  const [groomerId, setGroomerId] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [groomingInstructions, setGroomingInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groomingLocations = (locations || []).filter((loc: any) =>
    loc.isActive && loc.enabledModules?.includes('grooming')
  );

  useEffect(() => {
    const locId = selectedLocationForAppt || undefined;
    fetchGroomers(locId);
  }, [selectedLocationForAppt]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      'X-User-Token': `Bearer ${session.access_token}`,
    };
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ search: query });
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/households?${params}`,
        { headers }
      );

      if (!response.ok) {
        setSearchResults([]);
        return;
      }

      const data = await response.json();
      const results: SearchResult[] = (data || []).map((h: any) => ({
        household_id: h.id,
        household_name: h.name,
      }));
      setSearchResults(results);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const fetchPetsForHousehold = async (householdId: string) => {
    setIsLoadingPets(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/households/${householdId}`,
        { headers }
      );

      if (!response.ok) {
        setPets([]);
        return;
      }

      const data = await response.json();
      const householdPets: Pet[] = (data.pets || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        breed: p.breed,
        size: p.size,
      }));
      setPets(householdPets);
    } catch {
      setPets([]);
    } finally {
      setIsLoadingPets(false);
    }
  };

  const handleSelectHousehold = (household: SearchResult) => {
    setSelectedHousehold(household);
    setSearchQuery(household.household_name);
    setShowResults(false);
    setSelectedPetId('');
    setPets([]);
    fetchPetsForHousehold(household.household_id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedHousehold) {
      toast.error('Please select a customer');
      return;
    }
    if (!selectedPetId) {
      toast.error('Please select a pet');
      return;
    }
    if (!serviceType) {
      toast.error('Please select a service type');
      return;
    }
    if (!appointmentDate) {
      toast.error('Please select a date');
      return;
    }
    if (!appointmentTime) {
      toast.error('Please select a time');
      return;
    }
    if (!selectedLocationForAppt) {
      toast.error('Please select a location');
      return;
    }

    const selectedPet = pets.find(p => p.id === selectedPetId);
    const serviceInfo = SERVICE_TYPES[serviceType];
    const effectiveGroomerId = groomerId && groomerId !== 'unassigned' ? groomerId : undefined;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session.access_token}`,
        };
        const params = new URLSearchParams({ pet_id: selectedPetId, date: appointmentDate });
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/grooming/appointments?${params}`,
          { headers },
        );
        if (res.ok) {
          const existing: any[] = await res.json();
          const conflict = existing.find(a => a.status !== 'cancelled');
          if (conflict) {
            toast.error(`${selectedPet?.name || 'This pet'} already has a grooming appointment on this date`);
            return;
          }
        }
      }
    } catch {
    }

    setIsSubmitting(true);
    try {
      await createAppointment({
        household_id: selectedHousehold.household_id,
        household_name: selectedHousehold.household_name,
        pet_id: selectedPetId,
        pet_name: selectedPet?.name || '',
        pet_breed: selectedPet?.breed,
        pet_size: selectedPet?.size as any,
        location_id: selectedLocationForAppt,
        service_type: serviceType,
        service_name: serviceInfo.label,
        estimated_duration_minutes: serviceInfo.defaultDuration,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: 'confirmed',
        groomer_id: effectiveGroomerId,
        customer_notes: customerNotes || undefined,
        grooming_instructions: groomingInstructions || undefined,
      });

      toast.success('Appointment created successfully');
      navigate('/grooming/appointments');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedServiceDuration = serviceType ? SERVICE_TYPES[serviceType]?.defaultDuration : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grooming/appointments')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">New Grooming Appointment</h1>
          <p className="text-slate-600 mt-1">Book a grooming session</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer & Pet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Label htmlFor="customer-search">Customer</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="customer-search"
                  placeholder="Search by customer name, email, or pet name..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  className="pl-10"
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>

              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.household_id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      onClick={() => handleSelectHousehold(result)}
                    >
                      <p className="font-medium text-slate-900">{result.household_name}</p>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500">
                  No customers found
                </div>
              )}
            </div>

            {selectedHousehold && (
              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                <p className="font-medium text-slate-900">{selectedHousehold.household_name}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedHousehold(null);
                    setPets([]);
                    setSelectedPetId('');
                    setSearchQuery('');
                  }}
                >
                  Change
                </Button>
              </div>
            )}

            {selectedHousehold && isLoadingPets && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading pets...
              </div>
            )}

            {selectedHousehold && !isLoadingPets && pets.length > 0 && (
              <div>
                <Label htmlFor="pet-select">Pet</Label>
                <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                  <SelectTrigger id="pet-select" className="mt-1">
                    <SelectValue placeholder="Select a pet" />
                  </SelectTrigger>
                  <SelectContent>
                    {pets.map((pet) => (
                      <SelectItem key={pet.id} value={pet.id}>
                        {pet.name}{pet.breed ? ` (${pet.breed})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedHousehold && !isLoadingPets && pets.length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                No pets found for this customer. Please add a pet to the customer record first.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Service
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="service-type">Service Type</Label>
              <Select value={serviceType} onValueChange={(v) => setServiceType(v as GroomingServiceType)}>
                <SelectTrigger id="service-type" className="mt-1">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_TYPES).map(([value, { label, defaultDuration }]) => (
                    <SelectItem key={value} value={value}>
                      {label} ({defaultDuration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedServiceDuration && (
              <p className="text-sm text-slate-500">
                Estimated duration: {selectedServiceDuration} minutes
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date, Time & Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="appointment-date">Date</Label>
                <Input
                  id="appointment-date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="appointment-time">Time</Label>
                <Input
                  id="appointment-time"
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location-select">Location</Label>
              <Select value={selectedLocationForAppt} onValueChange={setSelectedLocationForAppt}>
                <SelectTrigger id="location-select" className="mt-1">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {groomingLocations.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="groomer-select">Groomer (optional)</Label>
              <Select value={groomerId || 'unassigned'} onValueChange={setGroomerId}>
                <SelectTrigger id="groomer-select" className="mt-1">
                  <SelectValue placeholder="Assign later" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Assign later</SelectItem>
                  {groomers.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customer-notes">Customer Notes</Label>
              <Textarea
                id="customer-notes"
                placeholder="Any notes from the customer..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="grooming-instructions">Grooming Instructions</Label>
              <Textarea
                id="grooming-instructions"
                placeholder="Specific grooming instructions or style preferences..."
                value={groomingInstructions}
                onChange={(e) => setGroomingInstructions(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/grooming/appointments')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !selectedHousehold || !selectedPetId || !serviceType || !selectedLocationForAppt}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Appointment'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
