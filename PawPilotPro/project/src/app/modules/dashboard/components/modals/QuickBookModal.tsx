import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Badge } from '../../../../components/ui/badge';
import { Search, Calendar as CalendarIcon, Clock, Scissors, Moon, Dog } from 'lucide-react';
import { useDaycareStore } from '../../../daycare/store';
import { useGroomingStore } from '../../../grooming/store';
import { useOvernightsStore } from '../../../overnights/store';
import { useDashboardStore } from '../../store';
import { useSettingsStore } from '../../../settings/store';
import { SERVICE_TYPES as GROOMING_SERVICE_TYPES } from '../../../grooming/types';
import type { GroomingServiceType } from '../../../grooming/types';
import { supabase } from '../../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../../utils/supabase/info';
import { toast } from 'sonner';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-User-Token': `Bearer ${session.access_token}`,
  };
}

type BookableService = 'daycare' | 'grooming' | 'overnights';
type Step = 'service' | 'search' | 'select-pet' | 'details';

const SERVICE_CONFIG = {
  daycare: {
    module: 'daycare',
    label: 'Daycare',
    description: 'Day attendance booking',
    Icon: Dog,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  grooming: {
    module: 'grooming',
    label: 'Grooming',
    description: 'Grooming appointment',
    Icon: Scissors,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  overnights: {
    module: 'overnights',
    label: 'Overnights',
    description: 'Overnight boarding reservation',
    Icon: Moon,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
} as const;

const BOOKABLE_SERVICES: BookableService[] = ['daycare', 'grooming', 'overnights'];

const DAYCARE_VARIANTS = [
  { serviceType: 'full_day', label: 'Full Day', startTime: '08:00', endTime: '17:00' },
  { serviceType: 'half_day', label: 'Half Day (AM)', startTime: '08:00', endTime: '13:00' },
  { serviceType: 'half_day', label: 'Half Day (PM)', startTime: '13:00', endTime: '17:00' },
];

function today() {
  return new Date().toISOString().split('T')[0];
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

interface QuickBookModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickBookModal({ open, onClose }: QuickBookModalProps) {
  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<BookableService | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [daycareVariantLabel, setDaycareVariantLabel] = useState('Full Day');
  const [bookingDate, setBookingDate] = useState(today());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');

  const [groomingServiceType, setGroomingServiceType] = useState<GroomingServiceType>('bath_brush');
  const [appointmentDate, setAppointmentDate] = useState(today());
  const [appointmentTime, setAppointmentTime] = useState('09:00');

  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(tomorrow());

  const [notes, setNotes] = useState('');

  const { searchCustomers: searchDaycare, createBooking } = useDaycareStore();
  const { createAppointment, searchCustomers: searchGrooming } = useGroomingStore();
  const { createReservation, reservations: overnightReservations } = useOvernightsStore();
  const { selectedLocationId, refreshAllWidgets } = useDashboardStore();
  const { locations } = useSettingsStore();

  const selectedLocation = useMemo(
    () => locations.find(l => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const enabledServices = useMemo(
    () => BOOKABLE_SERVICES.filter(s =>
      selectedLocation?.enabledModules?.includes(SERVICE_CONFIG[s].module)
    ),
    [selectedLocation],
  );

  const nights = useMemo(() => {
    if (selectedService !== 'overnights') return 0;
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [startDate, endDate, selectedService]);

  const resetForm = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedHousehold(null);
    setSelectedPet(null);
    setNotes('');
    setDaycareVariantLabel('Full Day');
    setBookingDate(today());
    setStartTime('08:00');
    setEndTime('17:00');
    setGroomingServiceType('bath_brush');
    setAppointmentDate(today());
    setAppointmentTime('09:00');
    setStartDate(today());
    setEndDate(tomorrow());
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    if (enabledServices.length === 1) {
      setSelectedService(enabledServices[0]);
      setStep('search');
    } else {
      setSelectedService(null);
      setStep('service');
    }
  }, [open]);

  useEffect(() => {
    if (open && step === 'service' && enabledServices.length === 1) {
      setSelectedService(enabledServices[0]);
      setStep('search');
    }
  }, [enabledServices]);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      toast.error('Please enter at least 2 characters');
      return;
    }
    setSearching(true);
    try {
      const fn = selectedService === 'grooming' ? searchGrooming : searchDaycare;
      const results = await fn(searchQuery);
      setSearchResults(results);
      if (!results.length) toast.info('No households found');
    } catch (err: any) {
      toast.error(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectHousehold = (household: any) => {
    setSelectedHousehold(household);
    if (household.pets?.length === 1) {
      setSelectedPet(household.pets[0]);
      setStep('details');
    } else {
      setStep('select-pet');
    }
  };

  const checkForConflict = async (): Promise<string | null> => {
    if (!selectedPet || !selectedService) return null;
    try {
      const headers = await buildAuthHeaders();

      if (selectedService === 'daycare') {
        const params = new URLSearchParams({ pet_id: selectedPet.id, date: bookingDate });
        if (selectedLocationId !== 'ALL') params.set('location_id', selectedLocationId);
        const res = await fetch(`${API_BASE}/daycare/bookings?${params}`, { headers });
        if (res.ok) {
          const existing: any[] = await res.json();
          const conflict = existing.find(b => b.booking_status !== 'cancelled');
          if (conflict) return `${selectedPet.name} already has a daycare booking on this date`;
        }
      }

      if (selectedService === 'grooming') {
        const params = new URLSearchParams({ pet_id: selectedPet.id, date: appointmentDate });
        const res = await fetch(`${API_BASE}/grooming/appointments?${params}`, { headers });
        if (res.ok) {
          const existing: any[] = await res.json();
          const conflict = existing.find(a => a.status !== 'cancelled');
          if (conflict) return `${selectedPet.name} already has a grooming appointment on this date`;
        }
      }

      if (selectedService === 'overnights') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const conflict = overnightReservations.find(r =>
          r.petId === selectedPet.id &&
          r.status !== 'cancelled' &&
          new Date(r.startDate) < end &&
          new Date(r.endDate) > start
        );
        if (conflict) return `${selectedPet.name} already has an overnight reservation overlapping these dates`;
      }

      return null;
    } catch {
      return null;
    }
  };

  const handleCreate = async () => {
    if (!selectedHousehold || !selectedPet || !selectedService) return;
    if (selectedLocationId === 'ALL') {
      toast.error('Please select a specific location first');
      return;
    }
    setIsCreating(true);
    try {
      const conflict = await checkForConflict();
      if (conflict) {
        toast.error(conflict);
        return;
      }
      if (selectedService === 'daycare') {
        const variant = DAYCARE_VARIANTS.find(v => v.label === daycareVariantLabel) ?? DAYCARE_VARIANTS[0];
        await createBooking({
          household_id: selectedHousehold.household_id,
          pet_id: selectedPet.id,
          location_id: selectedLocationId,
          location_name: selectedLocation?.name ?? '',
          service_id: `service-daycare-${variant.serviceType}`,
          service_name: `Daycare (${variant.label})`,
          service_type: variant.serviceType,
          booking_date: bookingDate,
          planned_start_time: startTime,
          planned_end_time: endTime,
          customer_notes: notes || undefined,
        });
        toast.success(`Daycare booking created for ${selectedPet.name}`);
      } else if (selectedService === 'grooming') {
        const serviceInfo = GROOMING_SERVICE_TYPES[groomingServiceType];
        await createAppointment({
          household_id: selectedHousehold.household_id,
          household_name: selectedHousehold.household_name,
          pet_id: selectedPet.id,
          pet_name: selectedPet.name,
          pet_breed: selectedPet.breed,
          pet_size: selectedPet.size,
          location_id: selectedLocationId,
          location_name: selectedLocation?.name ?? '',
          service_type: groomingServiceType,
          service_name: serviceInfo.label,
          estimated_duration_minutes: serviceInfo.defaultDuration,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          status: 'confirmed',
          customer_notes: notes || undefined,
        });
        toast.success(`Grooming appointment created for ${selectedPet.name}`);
      } else if (selectedService === 'overnights') {
        await createReservation({
          customerId: selectedHousehold.household_id,
          petId: selectedPet.id,
          householdId: selectedHousehold.household_id,
          startDate,
          endDate,
          checkInWindow: { start: '14:00', end: '18:00' },
          checkOutWindow: { start: '08:00', end: '11:00' },
          locationId: selectedLocationId,
          status: 'confirmed',
          specialInstructions: notes || undefined,
          requiresMedication: false,
          hasBehaviourConcerns: false,
          hasAllergies: false,
          pricePerNight: 0,
          totalNights: nights,
          totalPrice: 0,
          currency: 'GBP',
          priceLockedAt: new Date().toISOString(),
          requiresPickup: false,
          requiresDropOff: false,
          petName: selectedPet.name,
          customerName: selectedHousehold.household_name,
        } as any);
        toast.success(`Overnight reservation created for ${selectedPet.name}`);
      }

      refreshAllWidgets?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create booking');
    } finally {
      setIsCreating(false);
    }
  };

  const svc = selectedService ? SERVICE_CONFIG[selectedService] : null;
  const canSubmit = step === 'details' && !isCreating && (selectedService !== 'overnights' || nights > 0);

  const stepTitle = () => {
    if (step === 'service') return 'New Booking — Select Service';
    if (step === 'search') return `${svc?.label ?? 'Booking'} — Search Household`;
    if (step === 'select-pet') return `${svc?.label ?? 'Booking'} — Select Pet`;
    return `${svc?.label ?? 'Booking'} — Details`;
  };

  const stepDesc = () => {
    if (step === 'service') return 'Choose which service to book at this location';
    if (step === 'search') return 'Search by household name, pet name, or contact';
    if (step === 'select-pet') return `Select a pet from ${selectedHousehold?.household_name}`;
    return `Create ${svc?.label?.toLowerCase() ?? 'booking'} for ${selectedPet?.name}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {stepTitle()}
          </DialogTitle>
          <DialogDescription>{stepDesc()}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">

          {/* ── Service picker ─────────────────────────── */}
          {step === 'service' && (
            <div className="grid gap-3 py-2">
              {enabledServices.map(serviceId => {
                const cfg = SERVICE_CONFIG[serviceId];
                const Icon = cfg.Icon;
                return (
                  <button
                    key={serviceId}
                    onClick={() => { setSelectedService(serviceId); setStep('search'); }}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 ${cfg.border} ${cfg.bg} hover:opacity-90 transition-all text-left w-full`}
                  >
                    <div className="p-2.5 rounded-lg bg-white/80 shadow-sm">
                      <Icon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                    <div>
                      <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-sm text-slate-500">{cfg.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Search ─────────────────────────────────── */}
          {step === 'search' && (
            <div className="space-y-4 py-2">
              {enabledServices.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => { setStep('service'); setSearchResults([]); setSearchQuery(''); }}>
                  ← Change service
                </Button>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search households…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                    autoFocus
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? 'Searching…' : 'Search'}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
                  {searchResults.map(result => (
                    <button
                      key={result.household_id}
                      onClick={() => handleSelectHousehold(result)}
                      className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="font-medium">{result.household_name}</div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        {result.pets?.length ?? 0} pet(s)
                        {result.pets?.length > 0 && (
                          <span className="text-slate-400"> · {result.pets.map((p: any) => p.name).join(', ')}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Pet picker ─────────────────────────────── */}
          {step === 'select-pet' && selectedHousehold && (
            <div className="space-y-4 py-2">
              <Button variant="ghost" size="sm" onClick={() => { setStep('search'); setSelectedHousehold(null); }}>
                ← Back to search
              </Button>
              <div className="border rounded-lg divide-y">
                {selectedHousehold.pets.map((pet: any) => (
                  <button
                    key={pet.id}
                    onClick={() => { setSelectedPet(pet); setStep('details'); }}
                    className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    {pet.photo_url && (
                      <img src={pet.photo_url} alt={pet.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{pet.name}</div>
                      <div className="text-sm text-slate-500">{pet.breed}</div>
                    </div>
                    {pet.vaccination_status && pet.vaccination_status !== 'up_to_date' && pet.vaccination_status !== 'valid' && (
                      <Badge variant="outline" className={`text-xs shrink-0 ${
                        pet.vaccination_status === 'expired' ? 'border-red-500 text-red-600' :
                        pet.vaccination_status === 'expiring_soon' ? 'border-orange-500 text-orange-600' :
                        'border-slate-400 text-slate-500'
                      }`}>
                        {pet.vaccination_status === 'expired' ? 'Vaccination Expired' :
                         pet.vaccination_status === 'expiring_soon' ? 'Vaccination Expiring' : 'No Records'}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Details ────────────────────────────────── */}
          {step === 'details' && selectedPet && (
            <div className="space-y-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep(selectedHousehold?.pets?.length > 1 ? 'select-pet' : 'search');
                  setSelectedPet(null);
                }}
              >
                ← Back
              </Button>

              <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
                {selectedPet.photo_url && (
                  <img src={selectedPet.photo_url} alt={selectedPet.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{selectedPet.name}</p>
                  <p className="text-sm text-slate-500">{selectedHousehold?.household_name}</p>
                </div>
              </div>

              {/* Daycare fields */}
              {selectedService === 'daycare' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dc-date">Date</Label>
                      <Input id="dc-date" type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="dc-type">Service</Label>
                      <select
                        id="dc-type"
                        value={daycareVariantLabel}
                        onChange={e => {
                          const label = e.target.value;
                          const v = DAYCARE_VARIANTS.find(x => x.label === label) ?? DAYCARE_VARIANTS[0];
                          setDaycareVariantLabel(label);
                          setStartTime(v.startTime);
                          setEndTime(v.endTime);
                        }}
                        className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      >
                        {DAYCARE_VARIANTS.map(v => (
                          <option key={v.label} value={v.label}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dc-start"><Clock className="h-3 w-3 inline mr-1" />Start Time</Label>
                      <Input id="dc-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="dc-end"><Clock className="h-3 w-3 inline mr-1" />End Time</Label>
                      <Input id="dc-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                </>
              )}

              {/* Grooming fields */}
              {selectedService === 'grooming' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="gr-date">Date</Label>
                      <Input id="gr-date" type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="gr-time"><Clock className="h-3 w-3 inline mr-1" />Time</Label>
                      <Input id="gr-time" type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="gr-service">Service Type</Label>
                    <select
                      id="gr-service"
                      value={groomingServiceType}
                      onChange={e => setGroomingServiceType(e.target.value as GroomingServiceType)}
                      className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      {Object.entries(GROOMING_SERVICE_TYPES).map(([value, { label, defaultDuration }]) => (
                        <option key={value} value={value}>{label} ({defaultDuration} min)</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Overnights fields */}
              {selectedService === 'overnights' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ov-start">Check-in Date</Label>
                      <Input id="ov-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="ov-end">Check-out Date</Label>
                      <Input id="ov-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  {nights > 0 && (
                    <p className="text-sm text-slate-500">{nights} night{nights !== 1 ? 's' : ''}</p>
                  )}
                  {nights === 0 && (
                    <p className="text-sm text-red-500">Check-out date must be after check-in date</p>
                  )}
                </>
              )}

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special requirements or notes…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          {step === 'details' && (
            <Button onClick={handleCreate} disabled={!canSubmit} className="min-w-32">
              {isCreating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Creating…
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Create {svc?.label ?? 'Booking'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
