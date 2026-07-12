// Create Booking Dialog - Search and select household/pet for daycare booking

import React, { useState, useEffect, useRef } from 'react';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import { projectId } from '../../../../../utils/supabase/info';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { MagnifyingGlass, Dog, Calendar, Warning, CaretLeft, Medal, CreditCard, MapPin, Moon, CalendarBlank } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useConnectivity } from '../../../hooks/useConnectivity';
import { MEMBERSHIP_PLANS } from '../../packages/membership-plans';
import { CreateReservationModal, type ReservationPrefill } from '../../overnights/components/CreateReservationModal';
import { expandDateRange, WEEKDAYS_MON_FRI, type Weekday } from '../lib/multiDayBooking';

type BookingLength = 'single' | 'multi';
type StayType = 'day_visits' | 'overnight';

/** Weekday toggle order shown in the multi-day picker (Mon-first). */
const WEEKDAY_CHIPS: { day: Weekday; label: string }[] = [
  { day: 1, label: 'M' }, { day: 2, label: 'T' }, { day: 3, label: 'W' },
  { day: 4, label: 'T' }, { day: 5, label: 'F' }, { day: 6, label: 'S' }, { day: 0, label: 'S' },
];

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Prefill the booking date (e.g. opened from a capacity planner day). */
  initialDate?: string;
}

type ServiceType = 'full_day' | 'half_day_am' | 'half_day_pm';
type BillingType = 'membership' | 'payg';

const SERVICE_OPTIONS: Record<ServiceType, { label: string; start: string; end: string; serviceId: string; serviceName: string }> = {
  full_day:     { label: 'Full Day',       start: '07:00', end: '18:00', serviceId: 'service-daycare-full',    serviceName: 'Daycare (Full Day)' },
  half_day_am:  { label: 'Half Day (AM)',  start: '07:00', end: '13:00', serviceId: 'service-daycare-half-am', serviceName: 'Daycare (Half Day AM)' },
  half_day_pm:  { label: 'Half Day (PM)',  start: '13:00', end: '18:00', serviceId: 'service-daycare-half-pm', serviceName: 'Daycare (Half Day PM)' },
};

interface HouseholdMembership {
  customerPackageId: string;
  planId: string;
  planName: string;
  creditsRemaining?: number;
  creditsTotal?: number;
  isHalfDay: boolean;
}

export function CreateBookingDialog({ open, onOpenChange, onSuccess, initialDate }: CreateBookingDialogProps) {
  const { selectedLocationId } = useDashboardStore();
  const { locations, globalEnabledModules } = useSettingsStore();
  const { searchCustomers, createBooking, isLoading } = useDaycareStore();
  const isOnline = useConnectivity();
  const overnightsEnabled = (globalEnabledModules ?? []).includes('overnights');

  const [step, setStep] = useState<'search' | 'select-pet' | 'details'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState<ServiceType>('full_day');
  const [billingType, setBillingType] = useState<BillingType>('payg');
  const [householdMembership, setHouseholdMembership] = useState<HouseholdMembership | null>(null);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [notes, setNotes] = useState('');
  const [localLocationId, setLocalLocationId] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multi-day
  const [bookingLength, setBookingLength] = useState<BookingLength>('single');
  const [endDate, setEndDate] = useState('');
  const [stayType, setStayType] = useState<StayType>('day_visits');
  const [weekdays, setWeekdays] = useState<Set<Weekday>>(new Set(WEEKDAYS_MON_FRI));
  const [creatingMulti, setCreatingMulti] = useState(false);
  const [overnightHandoff, setOvernightHandoff] = useState<ReservationPrefill | null>(null);

  const isOvernight = bookingLength === 'multi' && stayType === 'overnight';
  // Concrete day-visit dates for the current range/weekday selection.
  const dayVisitDates =
    bookingLength === 'multi' && stayType === 'day_visits'
      ? expandDateRange(bookingDate, endDate, weekdays)
      : [bookingDate];

  useEffect(() => {
    if (!open) {
      setStep('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedHousehold(null);
      setSelectedPet(null);
      setBookingDate(new Date().toISOString().split('T')[0]);
      setServiceType('full_day');
      setBillingType('payg');
      setHouseholdMembership(null);
      setNotes('');
      setLocalLocationId(selectedLocationId === 'ALL' ? '' : selectedLocationId);
      setBookingLength('single');
      setEndDate('');
      setStayType('day_visits');
      setWeekdays(new Set(WEEKDAYS_MON_FRI));
      setCreatingMulti(false);
      setOvernightHandoff(null);
    }
  }, [open]);

  // Prefill the date when opened from a planner day (falls back to the
  // close-reset default of today otherwise).
  useEffect(() => {
    if (open && initialDate) setBookingDate(initialDate);
  }, [open, initialDate]);

  // Keep localLocationId in sync when dialog opens with a specific location already selected
  useEffect(() => {
    if (open && selectedLocationId !== 'ALL') {
      setLocalLocationId(selectedLocationId);
    }
  }, [open, selectedLocationId]);

  // Debounced live search
  useEffect(() => {
    if (step !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchCustomers(searchQuery);
        setSearchResults(results);
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, step]);

  // Non-blocking membership check when household is selected
  useEffect(() => {
    if (!selectedHousehold) return;
    setHouseholdMembership(null);
    setBillingType('payg');

    const checkMembership = async () => {
      setCheckingMembership(true);
      try {
        const res = await fetch(
          `${API_URL}/customer-packages?customer_id=${selectedHousehold.household_id}&status=active`,
          {
            headers: await getAuthHeaders(),
          }
        );
        if (!res.ok) return;

        const data = await res.json();
        const active = (data.packages || []).find((p: any) => p.status === 'active');
        if (!active) return;

        const plan = MEMBERSHIP_PLANS.find(p => p.id === active.package_id || p.name === active.package_name);
        setHouseholdMembership({
          customerPackageId: active.id,
          planId: active.package_id || active.id,
          planName: active.package_name,
          creditsRemaining: active.credits_remaining,
          creditsTotal: active.credits_total,
          isHalfDay: plan?.sessionType === 'half_day' ?? false,
        });
        setBillingType('membership');
      } catch { /* silent — default to PAYG */ }
      finally { setCheckingMembership(false); }
    };

    checkMembership();
  }, [selectedHousehold?.household_id]);

  const handleSelectHousehold = (household: any) => {
    setSelectedHousehold(household);
    if (household.pets.length === 1) {
      setSelectedPet(household.pets[0]);
      setStep('details');
    } else {
      setStep('select-pet');
    }
  };

  const handleSelectPet = (pet: any) => {
    setSelectedPet(pet);
    setStep('details');
  };

  // Shared service/time resolution — identical for single and each day of a
  // multi-day range so a range bills exactly like N single bookings.
  const resolveServiceFields = () => {
    if (billingType === 'membership' && householdMembership) {
      return {
        serviceId: householdMembership.isHalfDay ? 'service-daycare-half-am' : 'service-daycare-full',
        serviceName: householdMembership.isHalfDay ? 'Daycare — Membership (Half Day)' : 'Daycare — Membership (Full Day)',
        finalServiceType: 'membership',
        startTime: '07:00',
        endTime: householdMembership.isHalfDay ? '13:00' : '18:00',
      };
    }
    const svc = SERVICE_OPTIONS[serviceType];
    return {
      serviceId: svc.serviceId,
      serviceName: svc.serviceName,
      finalServiceType: serviceType,
      startTime: svc.start,
      endTime: svc.end,
    };
  };

  const baseBookingPayload = () => {
    const svc = resolveServiceFields();
    const hh = selectedHousehold as { household_id: string };
    const petSel = selectedPet as { id: string };
    return {
      household_id: hh.household_id,
      pet_id: petSel.id,
      location_id: localLocationId,
      location_name: locations.find(l => l.id === localLocationId)?.name || 'Unknown Location',
      service_id: svc.serviceId,
      service_name: svc.serviceName,
      service_type: svc.finalServiceType as any,
      planned_start_time: svc.startTime,
      planned_end_time: svc.endTime,
      customer_notes: notes,
    };
  };

  const handleCreateBooking = async () => {
    if (!selectedHousehold || !selectedPet) {
      toast.error('Please select a household and pet');
      return;
    }
    if (!localLocationId) {
      toast.error('Please select a location');
      return;
    }

    try {
      await createBooking({ ...baseBookingPayload(), booking_date: bookingDate });
      toast.success(`Booking created for ${selectedPet.name}`);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    }
  };

  // Multi-day day-visits: create one daycare booking per selected date, all
  // sharing a group id. Each hits the server's per-day capacity check, so a
  // full day is skipped (not fatal) and reported in the summary.
  const handleCreateDayVisits = async () => {
    if (!selectedHousehold || !selectedPet) {
      toast.error('Please select a household and pet');
      return;
    }
    if (!localLocationId) {
      toast.error('Please select a location');
      return;
    }
    if (dayVisitDates.length === 0) {
      toast.error('Pick an end date and at least one weekday');
      return;
    }

    const groupId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `grp-${Date.now()}`;
    const payload = baseBookingPayload();
    let created = 0;
    const skipped: string[] = [];

    const petName = (selectedPet as { name: string }).name;
    setCreatingMulti(true);
    try {
      for (const date of dayVisitDates) {
        try {
          await createBooking({ ...payload, booking_date: date, booking_group_id: groupId });
          created += 1;
        } catch (error) {
          skipped.push(`${date}: ${error instanceof Error ? error.message : 'failed'}`);
        }
      }
    } finally {
      setCreatingMulti(false);
    }

    if (created > 0 && skipped.length === 0) {
      toast.success(`Created ${created} bookings for ${petName}`);
      onSuccess();
    } else if (created > 0) {
      toast.warning(`Created ${created} of ${dayVisitDates.length}. Skipped ${skipped.length} (${skipped[0]})`);
      onSuccess();
    } else {
      toast.error(`No bookings created. ${skipped[0] ?? ''}`);
    }
  };

  // Overnight boarding: hand household/pet/dates to the overnights module,
  // which owns per-night pricing, sleeping-area capacity and the review step.
  const handleOvernightHandoff = () => {
    if (!selectedHousehold || !selectedPet) {
      toast.error('Please select a household and pet');
      return;
    }
    if (!endDate || endDate <= bookingDate) {
      toast.error('An overnight stay needs an end date after the start date');
      return;
    }
    setOvernightHandoff({
      household: selectedHousehold,
      pet: selectedPet,
      startDate: bookingDate,
      endDate,
    });
  };

  const handlePrimaryAction = () => {
    if (bookingLength === 'single') { void handleCreateBooking(); return; }
    if (isOvernight) { handleOvernightHandoff(); return; }
    void handleCreateDayVisits();
  };

  // Default the end date to the start when the operator first switches to a
  // multi-day booking, so the range is always valid to begin with.
  const handleBookingLengthChange = (next: BookingLength) => {
    setBookingLength(next);
    if (next === 'multi' && !endDate) setEndDate(bookingDate);
  };

  const toggleWeekday = (day: Weekday) => {
    setWeekdays(prev => {
      const nextSet = new Set(prev);
      if (nextSet.has(day)) nextSet.delete(day);
      else nextSet.add(day);
      return nextSet;
    });
  };

  return (
    <>
    <Dialog open={open && !overnightHandoff} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'search' && 'New Booking'}
            {step === 'select-pet' && 'Select Pet'}
            {step === 'details' && 'Booking Details'}
          </DialogTitle>
          <DialogDescription>
            {step === 'search' && 'Type a name, email or phone to search households'}
            {step === 'select-pet' && `Select a pet from ${selectedHousehold?.household_name}`}
            {step === 'details' && `Creating booking for ${selectedPet?.name}`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Live search */}
        {step === 'search' && (
          <div className="space-y-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                autoFocus
                placeholder="Search households..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching…</span>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-80 overflow-y-auto divide-y rounded-lg border">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectHousehold(result)}
                    className="flex items-start justify-between p-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{result.household_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Dog size={12} className="text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {result.pets.map((p: any) => p.name).join(', ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">{result.pets.length} pet{result.pets.length !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">No households found</p>
            )}
          </div>
        )}

        {/* Step 2: Select pet */}
        {step === 'select-pet' && selectedHousehold && (
          <div className="space-y-3">
            <button
              onClick={() => setStep('search')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <CaretLeft size={14} /> Back
            </button>

            <div className="divide-y rounded-lg border">
              {selectedHousehold.pets.map((pet: any) => (
                <div
                  key={pet.id}
                  onClick={() => handleSelectPet(pet)}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                >
                  {pet.photo_url ? (
                    <img src={pet.photo_url} alt={pet.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-tint flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">{pet.name[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{pet.name}</p>
                    {pet.breed && <p className="text-xs text-slate-500">{pet.breed}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    {pet.behaviour_notes && (
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                        <Warning size={10} className="mr-0.5" />Behaviour
                      </Badge>
                    )}
                    {pet.medical_notes && (
                      <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                        <Warning size={10} className="mr-0.5" />Medical
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Booking details */}
        {step === 'details' && selectedPet && (
          <div className="space-y-4">
            <button
              onClick={() => setStep(selectedHousehold?.pets.length === 1 ? 'search' : 'select-pet')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <CaretLeft size={14} /> Back
            </button>

            {/* Pet summary */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              {selectedPet.photo_url ? (
                <img src={selectedPet.photo_url} alt={selectedPet.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-tint flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">{selectedPet.name[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{selectedPet.name}</p>
                <p className="text-xs text-slate-500">{selectedHousehold?.household_name}</p>
              </div>
            </div>

            {/* Billing type toggle — overnight billing is handled by the
                boarding flow, so it's hidden here for overnight stays. */}
            {!isOvernight && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing</Label>
              {checkingMembership ? (
                <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* Membership option */}
                  <button
                    onClick={() => householdMembership && setBillingType('membership')}
                    disabled={!householdMembership}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      billingType === 'membership' && householdMembership
                        ? 'border-primary bg-primary-tint'
                        : householdMembership
                        ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Medal size={13} className={billingType === 'membership' && householdMembership ? 'text-primary' : 'text-slate-400'} />
                      <span className={`text-xs font-semibold ${billingType === 'membership' && householdMembership ? 'text-primary' : 'text-slate-600'}`}>
                        Membership
                      </span>
                    </div>
                    {householdMembership ? (
                      <p className="text-xs text-slate-500 truncate">
                        {householdMembership.planName}
                        {householdMembership.creditsRemaining !== undefined && (
                          <span className="font-semibold"> · {householdMembership.creditsRemaining} days left</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">No active plan</p>
                    )}
                  </button>

                  {/* Pay as you go option */}
                  <button
                    onClick={() => setBillingType('payg')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      billingType === 'payg'
                        ? 'border-primary bg-primary-tint'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CreditCard size={13} className={billingType === 'payg' ? 'text-primary' : 'text-slate-400'} />
                      <span className={`text-xs font-semibold ${billingType === 'payg' ? 'text-primary' : 'text-slate-600'}`}>
                        Pay as you go
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Standard rate applies</p>
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Location — only shown when "All Locations" is selected in the sidebar */}
            {selectedLocationId === 'ALL' && (
              <div>
                <Label htmlFor="booking-location" className="flex items-center gap-1.5 mb-1.5">
                  <MapPin size={14} /> Location
                </Label>
                <select
                  id="booking-location"
                  value={localLocationId}
                  onChange={(e) => setLocalLocationId(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select a location…</option>
                  {locations.filter(l => l?.isActive).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Booking length: single day vs a multi-day range */}
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Booking length</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleBookingLengthChange('single')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    bookingLength === 'single'
                      ? 'border-primary bg-primary-tint text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Calendar size={14} /> Single day
                </button>
                <button
                  type="button"
                  onClick={() => handleBookingLengthChange('multi')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    bookingLength === 'multi'
                      ? 'border-primary bg-primary-tint text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <CalendarBlank size={14} /> Multiple days
                </button>
              </div>
            </div>

            {/* Stay type — only when a range is chosen AND overnights is enabled */}
            {bookingLength === 'multi' && overnightsEnabled && (
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Stay type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStayType('day_visits')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      stayType === 'day_visits'
                        ? 'border-primary bg-primary-tint'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Dog size={13} className={stayType === 'day_visits' ? 'text-primary' : 'text-slate-400'} />
                      <span className={`text-xs font-semibold ${stayType === 'day_visits' ? 'text-primary' : 'text-slate-600'}`}>Day visits</span>
                    </div>
                    <p className="text-xs text-slate-500">Home each night</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStayType('overnight')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      stayType === 'overnight'
                        ? 'border-primary bg-primary-tint'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Moon size={13} className={stayType === 'overnight' ? 'text-primary' : 'text-slate-400'} />
                      <span className={`text-xs font-semibold ${stayType === 'overnight' ? 'text-primary' : 'text-slate-600'}`}>Overnight boarding</span>
                    </div>
                    <p className="text-xs text-slate-500">Stays overnight</p>
                  </button>
                </div>
              </div>
            )}

            {/* Date(s) */}
            <div className={bookingLength === 'multi' ? 'grid grid-cols-2 gap-2' : ''}>
              <div>
                <Label htmlFor="booking-date" className="flex items-center gap-1.5 mb-1.5">
                  <Calendar size={14} /> {bookingLength === 'multi' ? (isOvernight ? 'Check-in' : 'Start date') : 'Date'}
                </Label>
                <Input
                  id="booking-date"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                />
              </div>
              {bookingLength === 'multi' && (
                <div>
                  <Label htmlFor="booking-end-date" className="flex items-center gap-1.5 mb-1.5">
                    <Calendar size={14} /> {isOvernight ? 'Check-out' : 'End date'}
                  </Label>
                  <Input
                    id="booking-end-date"
                    type="date"
                    min={bookingDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Weekday picker — day visits only (overnight is continuous) */}
            {bookingLength === 'multi' && !isOvernight && (
              <div>
                <Label className="mb-1.5 block">Days of the week</Label>
                <div className="flex gap-1.5">
                  {WEEKDAY_CHIPS.map(({ day, label }, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      aria-pressed={weekdays.has(day)}
                      aria-label={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day]}
                      className={`h-9 w-9 rounded-full border text-sm font-medium transition-colors ${
                        weekdays.has(day)
                          ? 'border-primary bg-primary-tint text-primary'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-slate-500 mt-1.5">
                  {dayVisitDates.length > 0
                    ? `${dayVisitDates.length} booking${dayVisitDates.length !== 1 ? 's' : ''} will be created.`
                    : 'No days match — pick an end date and at least one weekday.'}
                </p>
              </div>
            )}

            {/* Overnight handoff note */}
            {isOvernight && (
              <div className="flex items-center gap-2 p-3 bg-primary-tint rounded-lg">
                <Moon size={15} className="text-primary flex-shrink-0" />
                <p className="text-sm text-slate-700">
                  Continue to boarding details for per-night pricing and sleeping-area capacity.
                </p>
              </div>
            )}

            {/* Service type — only shown for PAYG or if no membership */}
            {!isOvernight && billingType === 'payg' && (
              <div>
                <Label className="mb-1.5 block">Session</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(SERVICE_OPTIONS) as [ServiceType, typeof SERVICE_OPTIONS[ServiceType]][]).map(([key, opt]) => (
                    <button
                      key={key}
                      onClick={() => setServiceType(key)}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                        serviceType === key
                          ? 'border-primary bg-primary-tint text-primary'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block">{opt.label}</span>
                      <span className="block font-normal text-slate-400 mt-0.5">{opt.start}–{opt.end}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Membership session info — shown when using membership */}
            {!isOvernight && billingType === 'membership' && householdMembership && (
              <div className="flex items-center gap-2 p-3 bg-primary-tint rounded-lg">
                <Medal size={15} className="text-primary flex-shrink-0" />
                <p className="text-xs text-slate-700">
                  {dayVisitDates.length > 1
                    ? `${dayVisitDates.length} ${householdMembership.isHalfDay ? 'half' : 'full'} days will be deducted from `
                    : `1 ${householdMembership.isHalfDay ? 'half' : 'full'} day will be deducted from `}
                  <strong>{householdMembership.planName}</strong>
                  {householdMembership.creditsRemaining !== undefined && (
                    <> ({householdMembership.creditsRemaining} remaining)</>
                  )}
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="mb-1.5 block">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="notes"
                placeholder="Special requirements..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {!isOnline && step === 'details' && (
          <p className="text-xs text-red-700 text-center">
            You're offline — this booking can't be saved right now.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === 'details' && (
            <Button
              onClick={handlePrimaryAction}
              disabled={
                isLoading || creatingMulti || !localLocationId || !isOnline ||
                (bookingLength === 'multi' && !isOvernight && dayVisitDates.length === 0) ||
                (isOvernight && (!endDate || endDate <= bookingDate))
              }
              style={{ backgroundColor: 'var(--primary)' }}
              className="text-white hover:opacity-90 disabled:opacity-50"
            >
              {isLoading || creatingMulti
                ? 'Creating…'
                : isOvernight
                ? 'Continue to boarding'
                : bookingLength === 'multi'
                ? `Create ${dayVisitDates.length} Booking${dayVisitDates.length !== 1 ? 's' : ''}`
                : 'Create Booking'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Overnight boarding branch — reuses the overnights module's full flow
        (per-night pricing, sleeping-area capacity, review) with the pet and
        dates prefilled from here. */}
    {overnightsEnabled && (
      <CreateReservationModal
        open={!!overnightHandoff}
        prefill={overnightHandoff}
        onOpenChange={(o) => {
          if (!o) {
            setOvernightHandoff(null);
            onOpenChange(false);
          }
        }}
        onSuccess={() => {
          setOvernightHandoff(null);
          onSuccess();
        }}
      />
    )}
    </>
  );
}
