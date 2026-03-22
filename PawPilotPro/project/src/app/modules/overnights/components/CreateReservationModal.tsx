import React, { useState, useEffect } from 'react';
import { useOvernightsStore } from '../store';
import { useDaycareStore } from '../../daycare/store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Search,
  Dog,
  AlertTriangle,
  Pill,
  ShieldAlert,
  Loader2,
  PoundSterling,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface CreateReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateReservationModal({ open, onOpenChange, onSuccess }: CreateReservationModalProps) {
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { createReservation, calculateBilling, isLoading, reservations: existingReservations } = useOvernightsStore();
  const { searchCustomers } = useDaycareStore();

  const [step, setStep] = useState<'search' | 'select-pet' | 'details' | 'review'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [feedingInstructions, setFeedingInstructions] = useState('');
  const [medicationInstructions, setMedicationInstructions] = useState('');
  const [behaviourNotes, setBehaviourNotes] = useState('');
  const [requiresMedication, setRequiresMedication] = useState(false);
  const [hasBehaviourConcerns, setHasBehaviourConcerns] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [includeInDaycareAttendance, setIncludeInDaycareAttendance] = useState(true);

  const [billingBreakdown, setBillingBreakdown] = useState<any | null>(null);
  const [calculatingBilling, setCalculatingBilling] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurInterval, setRecurInterval] = useState<'weekly' | 'fortnightly' | 'monthly'>('weekly');
  const [recurEndType, setRecurEndType] = useState<'date' | 'count'>('count');
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurCount, setRecurCount] = useState(4);

  useEffect(() => {
    if (!open) {
      setStep('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedHousehold(null);
      setSelectedPet(null);
      setStartDate('');
      setEndDate('');
      setSpecialInstructions('');
      setFeedingInstructions('');
      setMedicationInstructions('');
      setBehaviourNotes('');
      setRequiresMedication(false);
      setHasBehaviourConcerns(false);
      setHasAllergies(false);
      setIncludeInDaycareAttendance(true);
      setBillingBreakdown(null);
      setIsRecurring(false);
      setRecurInterval('weekly');
      setRecurEndType('count');
      setRecurEndDate('');
      setRecurCount(4);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      setStartDate(tomorrow.toISOString().split('T')[0]);
      setEndDate(dayAfter.toISOString().split('T')[0]);
    }
  }, [open]);

  const generateRecurStays = (): { start: string; end: string }[] => {
    if (!startDate || !endDate) return [];
    if (!isRecurring) return [{ start: startDate, end: endDate }];

    const nights = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    const shiftStart = (i: number): string => {
      const d = new Date(startDate + 'T00:00:00');
      if (recurInterval === 'weekly') d.setDate(d.getDate() + 7 * i);
      else if (recurInterval === 'fortnightly') d.setDate(d.getDate() + 14 * i);
      else d.setMonth(d.getMonth() + i);
      return d.toISOString().split('T')[0];
    };
    const computeEnd = (s: string): string => {
      const d = new Date(s + 'T00:00:00');
      d.setDate(d.getDate() + nights);
      return d.toISOString().split('T')[0];
    };

    const stays: { start: string; end: string }[] = [];
    if (recurEndType === 'count') {
      for (let i = 0; i < Math.min(recurCount, 52); i++) {
        const s = shiftStart(i);
        stays.push({ start: s, end: computeEnd(s) });
      }
    } else if (recurEndDate) {
      for (let i = 0; stays.length < 52; i++) {
        const s = shiftStart(i);
        if (s > recurEndDate) break;
        stays.push({ start: s, end: computeEnd(s) });
      }
    } else {
      stays.push({ start: startDate, end: endDate });
    }
    return stays;
  };

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

  const handleProceedToReview = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select check-in and check-out dates');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('Check-out date must be after check-in date');
      return;
    }

    if (selectedPet && locationId) {
      setCalculatingBilling(true);
      try {
        const breakdown = await calculateBilling({
          reservationId: '',
          petId: selectedPet.id,
          locationId,
          startDate,
          endDate,
          totalNights,
        });
        setBillingBreakdown(breakdown);
      } catch {
        setBillingBreakdown(null);
      } finally {
        setCalculatingBilling(false);
      }
    }

    setStep('review');
  };

  const totalNights = startDate && endDate
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const locationId = selectedLocationId === 'ALL'
    ? locations[0]?.id || ''
    : selectedLocationId;

  const handleCreateReservation = async () => {
    if (!selectedHousehold || !selectedPet) {
      toast.error('Please select a household and pet');
      return;
    }

    if (selectedLocationId === 'ALL') {
      toast.error('Please select a specific location to create a reservation');
      return;
    }

    const stays = generateRecurStays();
    if (stays.length === 0) {
      toast.error('No valid stay dates to create');
      return;
    }

    const pricePerNight = billingBreakdown?.pricePerNight || 45;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    const locallyCreated: { start: Date; end: Date }[] = [];

    try {
      for (const stay of stays) {
        const stayStart = new Date(stay.start);
        const stayEnd = new Date(stay.end);
        const stayNights = Math.round((stayEnd.getTime() - stayStart.getTime()) / 86400000);

        const existingConflict = existingReservations.find(r =>
          r.petId === selectedPet.id &&
          r.status !== 'cancelled' &&
          new Date(r.startDate) < stayEnd &&
          new Date(r.endDate) > stayStart
        );
        const localConflict = locallyCreated.find(lc =>
          lc.start < stayEnd && lc.end > stayStart
        );

        if (existingConflict || localConflict) { skipped++; continue; }

        try {
          await createReservation({
            customerId: selectedHousehold.household_id,
            petId: selectedPet.id,
            householdId: selectedHousehold.household_id,
            startDate: stay.start,
            endDate: stay.end,
            checkInWindow: { start: '14:00', end: '18:00' },
            checkOutWindow: { start: '08:00', end: '11:00' },
            locationId,
            status: 'confirmed',
            specialInstructions: specialInstructions || undefined,
            feedingInstructions: feedingInstructions || undefined,
            medicationInstructions: medicationInstructions || undefined,
            behaviourNotes: behaviourNotes || undefined,
            requiresMedication,
            hasBehaviourConcerns,
            hasAllergies,
            pricePerNight,
            totalNights: stayNights,
            totalPrice: pricePerNight * stayNights,
            currency: 'GBP',
            priceLockedAt: new Date().toISOString(),
            requiresPickup: false,
            requiresDropOff: false,
            includeInDaycareAttendance,
            petName: selectedPet.name,
            customerName: selectedHousehold.household_name,
          });
          locallyCreated.push({ start: stayStart, end: stayEnd });
          created++;
        } catch {
          failed++;
        }
      }

      if (stays.length === 1) {
        if (created === 1) {
          toast.success(`Reservation created for ${selectedPet.name}`);
        } else {
          toast.error(`Failed to create reservation for ${selectedPet.name}`);
          return;
        }
      } else {
        const parts: string[] = [`Created ${created} reservation${created !== 1 ? 's' : ''} for ${selectedPet.name}`];
        if (skipped) parts.push(`${skipped} skipped (dates overlap)`);
        if (failed) parts.push(`${failed} failed`);
        if (created > 0) {
          toast.success(parts.join(' · '));
        } else {
          toast.error(`No reservations created — all ${skipped} stays overlap existing bookings`);
          return;
        }
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create reservations');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'search' && 'Search Household'}
            {step === 'select-pet' && 'Select Pet'}
            {step === 'details' && 'Reservation Details'}
            {step === 'review' && 'Review Reservation'}
          </DialogTitle>
          <DialogDescription>
            {step === 'search' && 'Search by household name, pet name, contact name, email, or phone'}
            {step === 'select-pet' && `Select a pet from ${selectedHousehold?.household_name}`}
            {step === 'details' && `Set overnight stay details for ${selectedPet?.name}`}
            {step === 'review' && 'Confirm the reservation details below'}
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
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
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
            <Button variant="ghost" size="sm" onClick={() => setStep('search')}>
              &larr; Back to search
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
                          <Pill className="h-3 w-3 mr-1" />
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
              &larr; Back
            </Button>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  {selectedPet.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{selectedPet.name}</p>
                  <p className="text-sm text-slate-500">
                    {selectedHousehold?.household_name} &middot; {selectedPet.breed || 'Unknown breed'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Check-in Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Check-out Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {totalNights > 0 && (
              <p className="text-sm text-slate-600">
                {totalNights} {totalNights === 1 ? 'night' : 'nights'}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                placeholder="Any special requirements for this stay..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedingInstructions">Feeding Instructions</Label>
              <Textarea
                id="feedingInstructions"
                placeholder="Feeding schedule, diet, portions..."
                value={feedingInstructions}
                onChange={(e) => setFeedingInstructions(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medicationInstructions">Medication Instructions</Label>
              <Textarea
                id="medicationInstructions"
                placeholder="Medication details, dosage, timing..."
                value={medicationInstructions}
                onChange={(e) => setMedicationInstructions(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="behaviourNotes">Behaviour Notes</Label>
              <Textarea
                id="behaviourNotes"
                placeholder="Behaviour flags, triggers, special handling..."
                value={behaviourNotes}
                onChange={(e) => setBehaviourNotes(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Flags</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requiresMedication"
                    checked={requiresMedication}
                    onCheckedChange={(checked) => setRequiresMedication(checked === true)}
                  />
                  <Label htmlFor="requiresMedication" className="font-normal">
                    Requires medication during stay
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasBehaviourConcerns"
                    checked={hasBehaviourConcerns}
                    onCheckedChange={(checked) => setHasBehaviourConcerns(checked === true)}
                  />
                  <Label htmlFor="hasBehaviourConcerns" className="font-normal">
                    Behaviour concerns
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasAllergies"
                    checked={hasAllergies}
                    onCheckedChange={(checked) => setHasAllergies(checked === true)}
                  />
                  <Label htmlFor="hasAllergies" className="font-normal">
                    Has allergies
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Daycare Attendance</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeInDaycareAttendance"
                  checked={includeInDaycareAttendance}
                  onCheckedChange={(checked) => setIncludeInDaycareAttendance(checked === true)}
                />
                <Label htmlFor="includeInDaycareAttendance" className="font-normal">
                  Include in daycare attendance list
                </Label>
              </div>
              <p className="text-xs text-slate-500">
                When enabled, this dog will appear in the daycare daily overview during their stay. Disable if the dog stays full-time with the sitter.
              </p>
            </div>

            {/* Recurring stays */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="crm-recurring"
                  checked={isRecurring}
                  onCheckedChange={v => {
                    setIsRecurring(v === true);
                    if (v && startDate) {
                      const end = new Date(startDate + 'T00:00:00');
                      end.setMonth(end.getMonth() + 3);
                      setRecurEndDate(end.toISOString().split('T')[0]);
                    }
                  }}
                />
                <Label htmlFor="crm-recurring" className="font-normal flex items-center gap-1.5 cursor-pointer">
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  Make this a recurring stay
                </Label>
              </div>

              {isRecurring && (
                <div className="pl-6 space-y-3 text-sm">
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Repeat every</Label>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {([
                        { value: 'weekly', label: 'Week' },
                        { value: 'fortnightly', label: '2 Weeks' },
                        { value: 'monthly', label: 'Month' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setRecurInterval(opt.value)}
                          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                            recurInterval === opt.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">End</Label>
                    <div className="flex gap-2 mt-1.5">
                      {(['count', 'date'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setRecurEndType(t)}
                          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                            recurEndType === t
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {t === 'count' ? 'After N stays' : 'On date'}
                        </button>
                      ))}
                    </div>
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
                        <span className="text-slate-500 text-sm">stays</span>
                      </div>
                    )}
                    {recurEndType === 'date' && (
                      <Input
                        type="date"
                        value={recurEndDate}
                        onChange={e => setRecurEndDate(e.target.value)}
                        className="mt-2 max-w-[180px]"
                      />
                    )}
                  </div>

                  {(() => {
                    const stays = generateRecurStays();
                    if (stays.length === 0) return null;
                    const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    return (
                      <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-blue-800 text-sm space-y-1">
                        <p>Will create <strong>{stays.length}</strong> stay{stays.length !== 1 ? 's' : ''} ({totalNights} {totalNights === 1 ? 'night' : 'nights'} each)</p>
                        {stays.length <= 4
                          ? <p>{stays.map(s => `${fmt(s.start)} → ${fmt(s.end)}`).join(', ')}</p>
                          : <p>{fmt(stays[0].start)} → {fmt(stays[0].end)} through {fmt(stays[stays.length - 1].start)} → {fmt(stays[stays.length - 1].end)}</p>
                        }
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleProceedToReview}>
                {isRecurring && generateRecurStays().length > 1
                  ? `Review ${generateRecurStays().length} Stays`
                  : 'Review Reservation'
                }
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'review' && selectedPet && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('details')}>
              &larr; Back to details
            </Button>

            <div className="border rounded-lg divide-y">
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-500 mb-1">Pet</h4>
                <p className="font-medium text-slate-900">{selectedPet.name}</p>
                <p className="text-sm text-slate-600">{selectedHousehold?.household_name}</p>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-500 mb-1">{isRecurring ? 'Stay Series' : 'Dates'}</h4>
                {isRecurring ? (() => {
                  const stays = generateRecurStays();
                  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">
                        {stays.length} stay{stays.length !== 1 ? 's' : ''} · {totalNights} {totalNights === 1 ? 'night' : 'nights'} each
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-0.5 mt-2">
                        {stays.map((s, i) => (
                          <p key={i} className="text-sm text-slate-600">{i + 1}. {fmt(s.start)} → {fmt(s.end)}</p>
                        ))}
                      </div>
                    </div>
                  );
                })() : (
                  <>
                    <p className="font-medium text-slate-900">
                      {new Date(startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {' '}&rarr;{' '}
                      {new Date(endDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-slate-600">
                      {totalNights} {totalNights === 1 ? 'night' : 'nights'}
                    </p>
                  </>
                )}
              </div>
              {(specialInstructions || feedingInstructions || medicationInstructions || behaviourNotes) && (
                <div className="p-4 space-y-2">
                  <h4 className="text-sm font-medium text-slate-500">Notes</h4>
                  {specialInstructions && (
                    <p className="text-sm text-slate-700"><span className="font-medium">Special:</span> {specialInstructions}</p>
                  )}
                  {feedingInstructions && (
                    <p className="text-sm text-slate-700"><span className="font-medium">Feeding:</span> {feedingInstructions}</p>
                  )}
                  {medicationInstructions && (
                    <p className="text-sm text-slate-700"><span className="font-medium">Medication:</span> {medicationInstructions}</p>
                  )}
                  {behaviourNotes && (
                    <p className="text-sm text-slate-700"><span className="font-medium">Behaviour:</span> {behaviourNotes}</p>
                  )}
                </div>
              )}
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Flags</h4>
                <div className="flex flex-wrap gap-2">
                  {requiresMedication && (
                    <Badge variant="outline" className="text-rose-600 border-rose-200">
                      <Pill className="h-3 w-3 mr-1" />
                      Medication Required
                    </Badge>
                  )}
                  {hasBehaviourConcerns && (
                    <Badge variant="outline" className="text-amber-600 border-amber-200">
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      Behaviour Concerns
                    </Badge>
                  )}
                  {hasAllergies && (
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Allergies
                    </Badge>
                  )}
                  {!requiresMedication && !hasBehaviourConcerns && !hasAllergies && (
                    <span className="text-sm text-slate-500">No flags</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-500 mb-1">Estimated Price</h4>
                {calculatingBilling ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculating...
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-slate-900">
                      &pound;{(billingBreakdown?.total || totalNights * 45).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      &pound;{(billingBreakdown?.pricePerNight || 45).toFixed(2)} per night &times; {totalNights} {totalNights === 1 ? 'night' : 'nights'}
                    </p>
                  </>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReservation} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : isRecurring && generateRecurStays().length > 1 ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Confirm {generateRecurStays().length} Stays
                  </>
                ) : (
                  'Confirm Reservation'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
