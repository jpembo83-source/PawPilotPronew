import React, { useState, useEffect } from 'react';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Search, Dog, AlertTriangle, Clock, Truck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SERVICE_TYPES } from '../types';
import { Checkbox } from '../../../components/ui/checkbox';
import { supabase } from '../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type BookingServiceType = 'full_day' | 'half_day' | 'trial_day';
type HalfDaySlot = 'morning' | 'afternoon';

const SERVICE_TIME_DEFAULTS: Record<BookingServiceType, { start: string; end: string }> = {
  full_day: { start: '08:00', end: '17:00' },
  half_day: { start: '08:00', end: '12:30' },
  trial_day: { start: '08:00', end: '12:30' },
};

const HALF_DAY_SLOTS: Record<HalfDaySlot, { start: string; end: string; label: string }> = {
  morning: { start: '08:00', end: '12:30', label: 'Morning (08:00–12:30)' },
  afternoon: { start: '12:30', end: '17:00', label: 'Afternoon (12:30–17:00)' },
};

export function CreateBookingDialog({ open, onOpenChange, onSuccess }: CreateBookingDialogProps) {
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { searchCustomers, createBooking, isLoading } = useDaycareStore();

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const isTransportEnabled = selectedLocation?.enabledModules?.includes('transport') ?? false;
  
  const [step, setStep] = useState<'search' | 'select-pet' | 'details'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState<BookingServiceType>('full_day');
  const [halfDaySlot, setHalfDaySlot] = useState<HalfDaySlot>('morning');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [requiresTransport, setRequiresTransport] = useState(false);
  const [transportPickupAddress, setTransportPickupAddress] = useState('');
  const [transportDropoffAddress, setTransportDropoffAddress] = useState('');
  const [searching, setSearching] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [recurEndType, setRecurEndType] = useState<'date' | 'count'>('date');
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurCount, setRecurCount] = useState(4);
  
  useEffect(() => {
    if (!open) {
      setStep('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedHousehold(null);
      setSelectedPet(null);
      setBookingDate(new Date().toISOString().split('T')[0]);
      setServiceType('full_day');
      setHalfDaySlot('morning');
      setStartTime('08:00');
      setEndTime('17:00');
      setNotes('');
      setRequiresTransport(false);
      setTransportPickupAddress('');
      setTransportDropoffAddress('');
      setIsRecurring(false);
      setRecurFrequency('weekly');
      setRecurDays([]);
      setRecurEndType('date');
      setRecurEndDate('');
      setRecurCount(4);
    }
  }, [open]);

  const generateRecurDates = (baseDate: string): string[] => {
    if (!isRecurring) return [baseDate];
    const dates: string[] = [];
    const start = new Date(baseDate + 'T00:00:00');
    const effectiveDays = recurDays.length > 0 ? recurDays : [start.getDay()];
    const addDate = (d: Date) => dates.push(d.toISOString().split('T')[0]);

    if (recurFrequency === 'daily') {
      if (recurEndType === 'count') {
        const cur = new Date(start);
        for (let i = 0; i < Math.min(recurCount, 365); i++) {
          addDate(cur);
          cur.setDate(cur.getDate() + 1);
        }
      } else if (recurEndDate) {
        const end = new Date(recurEndDate + 'T00:00:00');
        const cur = new Date(start);
        while (cur <= end && dates.length < 365) {
          addDate(cur);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        addDate(start);
      }
    } else {
      if (recurEndType === 'count') {
        let count = 0;
        const maxWeeks = Math.ceil(recurCount / effectiveDays.length) + 2;
        const cur = new Date(start);
        cur.setDate(cur.getDate() - cur.getDay());
        for (let w = 0; w <= maxWeeks && count < recurCount; w++) {
          for (const day of effectiveDays.slice().sort()) {
            const d = new Date(cur);
            d.setDate(cur.getDate() + day);
            if (d >= start && count < recurCount) { addDate(d); count++; }
          }
          cur.setDate(cur.getDate() + 7);
        }
      } else if (recurEndDate) {
        const end = new Date(recurEndDate + 'T00:00:00');
        const cur = new Date(start);
        cur.setDate(cur.getDate() - cur.getDay());
        while (cur <= end && dates.length < 365) {
          for (const day of effectiveDays.slice().sort()) {
            const d = new Date(cur);
            d.setDate(cur.getDate() + day);
            if (d >= start && d <= end) addDate(d);
          }
          cur.setDate(cur.getDate() + 7);
        }
      } else {
        addDate(start);
      }
    }
    return dates;
  };
  
  useEffect(() => {
    if (serviceType === 'half_day') {
      const slot = HALF_DAY_SLOTS[halfDaySlot];
      setStartTime(slot.start);
      setEndTime(slot.end);
    } else {
      const defaults = SERVICE_TIME_DEFAULTS[serviceType];
      setStartTime(defaults.start);
      setEndTime(defaults.end);
    }
  }, [serviceType, halfDaySlot]);
  
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      toast.error('Please enter at least 2 characters to search');
      return;
    }
    
    setSearching(true);
    try {
      const results = await searchCustomers(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info('No households found matching your search');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to search customers');
    } finally {
      setSearching(false);
    }
  };
  
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
  
  const getServiceId = (type: BookingServiceType): string => {
    const ids: Record<BookingServiceType, string> = {
      full_day: 'service-daycare-full',
      half_day: 'service-daycare-half',
      trial_day: 'service-daycare-trial',
    };
    return ids[type];
  };
  
  const getServiceName = (type: BookingServiceType): string => {
    return SERVICE_TYPES[type]?.label || 'Daycare';
  };
  
  const getLocationName = (): string => {
    const loc = locations.find(l => l.id === selectedLocationId);
    return loc?.name || 'Location';
  };
  
  const handleCreateBooking = async () => {
    if (!selectedHousehold || !selectedPet) {
      toast.error('Please select a household and pet');
      return;
    }
    
    if (selectedLocationId === 'ALL') {
      toast.error('Please select a specific location to create a booking');
      return;
    }

    const checkDateConflict = async (date: string): Promise<boolean> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return false;
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session.access_token}`,
        };
        const params = new URLSearchParams({ pet_id: selectedPet.id, date, location_id: selectedLocationId });
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare/bookings?${params}`,
          { headers },
        );
        if (res.ok) {
          const existing: any[] = await res.json();
          return existing.some(b => b.booking_status !== 'cancelled');
        }
      } catch { }
      return false;
    };

    const dates = generateRecurDates(bookingDate);
    let created = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (const date of dates) {
        const hasConflict = await checkDateConflict(date);
        if (hasConflict) { skipped++; continue; }
        try {
          const bookingData: any = {
            household_id: selectedHousehold.household_id,
            pet_id: selectedPet.id,
            location_id: selectedLocationId,
            location_name: getLocationName(),
            service_id: getServiceId(serviceType),
            service_name: getServiceName(serviceType),
            service_type: serviceType,
            booking_date: date,
            planned_start_time: startTime,
            planned_end_time: endTime,
            customer_notes: notes,
            requires_transport: requiresTransport,
          };
          if (requiresTransport) {
            bookingData.transport_pickup_address = transportPickupAddress;
            bookingData.transport_dropoff_address = transportDropoffAddress;
            bookingData.location_address = getLocationName();
          }
          await createBooking(bookingData);
          created++;
        } catch {
          failed++;
        }
      }

      if (dates.length === 1) {
        if (created === 1) {
          toast.success(`${getServiceName(serviceType)} booking created for ${selectedPet.name}`);
        } else {
          toast.error(`Failed to create booking for ${selectedPet.name}`);
          return;
        }
      } else {
        const parts: string[] = [`Created ${created} booking${created !== 1 ? 's' : ''} for ${selectedPet.name}`];
        if (skipped) parts.push(`${skipped} skipped (already booked)`);
        if (failed) parts.push(`${failed} failed`);
        if (created > 0) {
          toast.success(parts.join(' · '));
        } else {
          toast.error(`No bookings created — all ${skipped} dates already booked`);
          return;
        }
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create bookings');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'search' && 'Search Household'}
            {step === 'select-pet' && 'Select Pet'}
            {step === 'details' && 'Booking Details'}
          </DialogTitle>
          <DialogDescription>
            {step === 'search' && 'Search by household name, pet name, contact name, email, or phone'}
            {step === 'select-pet' && `Select a pet from ${selectedHousehold?.household_name}`}
            {step === 'details' && `Create booking for ${selectedPet?.name}`}
          </DialogDescription>
        </DialogHeader>
        
        {step === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search households..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching}>
                Search
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectHousehold(result)}
                    className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{result.household_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Dog className="h-3 w-3 text-slate-400" />
                          <span className="text-sm text-slate-600">
                            {result.pets.length} {result.pets.length === 1 ? 'pet' : 'pets'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {result.pets.map((pet: any) => (
                            <Badge key={pet.id} variant="outline">
                              {pet.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {step === 'select-pet' && selectedHousehold && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('search')}
            >
              ← Back to search
            </Button>
            
            <div className="space-y-2">
              {selectedHousehold.pets.map((pet: any) => (
                <div
                  key={pet.id}
                  onClick={() => handleSelectPet(pet)}
                  className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {pet.photo_url && (
                      <img
                        src={pet.photo_url}
                        alt={pet.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{pet.name}</p>
                      <p className="text-sm text-slate-600">{pet.breed}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pet.behaviour_notes && (
                        <Badge className="bg-amber-100 text-amber-700 border-0">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Behaviour
                        </Badge>
                      )}
                      {pet.medical_notes && (
                        <Badge className="bg-red-100 text-red-700 border-0">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Medical
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {step === 'details' && selectedPet && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(selectedHousehold?.pets.length === 1 ? 'search' : 'select-pet')}
            >
              ← Back
            </Button>
            
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-4">
                {selectedPet.photo_url && (
                  <img
                    src={selectedPet.photo_url}
                    alt={selectedPet.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-slate-900">{selectedPet.name}</p>
                  <p className="text-sm text-slate-600">{selectedHousehold?.household_name}</p>
                </div>
              </div>
            </div>
            
            <div>
              <Label>Service Type</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(['full_day', 'half_day', 'trial_day'] as BookingServiceType[]).map((type) => {
                  const config = SERVICE_TYPES[type];
                  const isSelected = serviceType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setServiceType(type)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
                        {config.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {type === 'full_day' && '08:00 – 17:00'}
                        {type === 'half_day' && '4.5 hours'}
                        {type === 'trial_day' && '08:00 – 12:30'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {serviceType === 'half_day' && (
              <div>
                <Label>Time Slot</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(['morning', 'afternoon'] as HalfDaySlot[]).map((slot) => {
                    const config = HALF_DAY_SLOTS[slot];
                    const isSelected = halfDaySlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => setHalfDaySlot(slot)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
                            {config.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="booking-date">Date</Label>
                <Input
                  id="booking-date"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Location</Label>
                <Input
                  value={getLocationName()}
                  disabled
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            
            {/* Recurring options */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cbd-recurring"
                  checked={isRecurring}
                  onCheckedChange={v => {
                    setIsRecurring(v === true);
                    if (v) {
                      const baseDay = new Date(bookingDate + 'T00:00:00').getDay();
                      setRecurDays([baseDay]);
                      const endD = new Date(bookingDate + 'T00:00:00');
                      endD.setDate(endD.getDate() + 28);
                      setRecurEndDate(endD.toISOString().split('T')[0]);
                    }
                  }}
                />
                <Label htmlFor="cbd-recurring" className="font-normal flex items-center gap-1.5 cursor-pointer">
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  Make this a recurring booking
                </Label>
              </div>

              {isRecurring && (
                <div className="pl-6 space-y-3 text-sm">
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Frequency</Label>
                    <div className="flex gap-2 mt-1.5">
                      {(['daily', 'weekly'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setRecurFrequency(f)}
                          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                            recurFrequency === f
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {f === 'daily' ? 'Daily' : 'Weekly'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {recurFrequency === 'weekly' && (
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wide">Repeat on</Label>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                          <button
                            key={d}
                            onClick={() => setRecurDays(prev =>
                              prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                            )}
                            className={`w-8 h-8 rounded-full text-xs font-semibold border transition-colors ${
                              recurDays.includes(i)
                                ? 'bg-primary text-white border-primary'
                                : 'border-slate-300 text-slate-600 hover:border-slate-400'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">End</Label>
                    <div className="flex gap-2 mt-1.5">
                      {(['date', 'count'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setRecurEndType(t)}
                          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                            recurEndType === t
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {t === 'date' ? 'On date' : 'After N bookings'}
                        </button>
                      ))}
                    </div>
                    {recurEndType === 'date' && (
                      <Input
                        type="date"
                        value={recurEndDate}
                        onChange={e => setRecurEndDate(e.target.value)}
                        className="mt-2 max-w-[180px]"
                      />
                    )}
                    {recurEndType === 'count' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          value={recurCount}
                          onChange={e => setRecurCount(Number(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-slate-500 text-sm">bookings</span>
                      </div>
                    )}
                  </div>

                  {(() => {
                    const dates = generateRecurDates(bookingDate);
                    if (dates.length === 0) return (
                      <p className="text-slate-500 text-sm">Configure the options above to preview your schedule.</p>
                    );
                    return (
                      <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-blue-800 text-sm">
                        Will create <strong>{dates.length}</strong> booking{dates.length !== 1 ? 's' : ''}
                        {dates.length <= 5
                          ? ': ' + dates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')
                          : ` from ${new Date(dates[0] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${new Date(dates[dates.length - 1] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                        }
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Any special requirements or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
            
            {isTransportEnabled && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requires-transport"
                    checked={requiresTransport}
                    onCheckedChange={(checked) => setRequiresTransport(checked === true)}
                  />
                  <Label htmlFor="requires-transport" className="font-normal flex items-center gap-2">
                    <Truck className="h-4 w-4 text-slate-500" />
                    Requires Transport
                  </Label>
                </div>
                
                {requiresTransport && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <Label htmlFor="pickup-address">Pickup Address</Label>
                      <Input
                        id="pickup-address"
                        placeholder="Address for pickup..."
                        value={transportPickupAddress}
                        onChange={(e) => setTransportPickupAddress(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dropoff-address">Drop-off Address</Label>
                      <Input
                        id="dropoff-address"
                        placeholder="Address for drop-off (leave empty if same as pickup)"
                        value={transportDropoffAddress}
                        onChange={(e) => setTransportDropoffAddress(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Transport jobs will be automatically created and assigned to available drivers.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === 'details' && (() => {
            const dates = isRecurring ? generateRecurDates(bookingDate) : [bookingDate];
            return (
              <Button onClick={handleCreateBooking} disabled={isLoading || (isRecurring && dates.length === 0)}>
                {isRecurring && dates.length > 1 ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Create {dates.length} Bookings
                  </>
                ) : (
                  'Create Booking'
                )}
              </Button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
