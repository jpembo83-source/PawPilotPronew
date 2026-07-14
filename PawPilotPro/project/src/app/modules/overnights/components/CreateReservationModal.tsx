import React, { useState, useEffect } from 'react';
import { useOvernightsStore } from '../store';
import { useDaycareStore } from '../../daycare/store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { useCurrency } from '../../../utils/currency';
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
  MagnifyingGlass,
  Dog,
  Warning,
  Pill,
  ShieldWarning,
  CircleNotch,
  PoundSterling,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

/** Household/pet/dates handed over from another booking flow (e.g. the daycare
 *  dialog's "Overnight boarding" branch) so this modal opens at its details
 *  step instead of making the operator search again. */
export interface ReservationPrefill {
  household: { household_id?: string; household_name?: string; pets?: any[]; [k: string]: any };
  /** Omit to open on pet-select (a household with several dogs). */
  pet?: any;
  startDate?: string;
  endDate?: string;
}

interface CreateReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prefill?: ReservationPrefill | null;
}

export function CreateReservationModal({ open, onOpenChange, onSuccess, prefill }: CreateReservationModalProps) {
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  // Overnight pricing follows the organisation currency (Settings → Organisation),
  // never a hardcoded £.
  const { currency, format: formatMoney } = useCurrency();
  const { createReservation, calculateBilling, isLoading } = useOvernightsStore();
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

  const [billingBreakdown, setBillingBreakdown] = useState<any | null>(null);
  const [calculatingBilling, setCalculatingBilling] = useState(false);

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
      setBillingBreakdown(null);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      const defaultStart = tomorrow.toISOString().split('T')[0];
      const defaultEnd = dayAfter.toISOString().split('T')[0];

      setStartDate(prefill?.startDate || defaultStart);
      setEndDate(prefill?.endDate || defaultEnd);
      if (prefill?.household) {
        // Skip the search step. A specific pet → details; a household with
        // several dogs → pet-select so the operator picks first.
        setSelectedHousehold(prefill.household);
        const pets = prefill.pet ? [prefill.pet] : (prefill.household.pets ?? []);
        if (prefill.pet || pets.length === 1) {
          setSelectedPet(prefill.pet ?? pets[0]);
          setStep('details');
        } else {
          setStep('select-pet');
        }
      }
    }
  }, [open]);

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
          currency,
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

    try {
      await createReservation({
        customerId: selectedHousehold.household_id,
        petId: selectedPet.id,
        householdId: selectedHousehold.household_id,
        startDate,
        endDate,
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
        pricePerNight: billingBreakdown?.pricePerNight || 45,
        totalNights,
        totalPrice: billingBreakdown?.total || totalNights * 45,
        currency,
        priceLockedAt: new Date().toISOString(),
        requiresPickup: false,
        requiresDropOff: false,
        petName: selectedPet.name,
        customerName: selectedHousehold.household_name,
      });

      toast.success(`Reservation created for ${selectedPet.name}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create reservation');
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
                <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search households..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <CircleNotch className="h-4 w-4 animate-spin" /> : 'Search'}
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
                          <Warning className="h-3 w-3 mr-1" />
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

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleProceedToReview}>
                Review Reservation
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
                <h4 className="text-sm font-medium text-slate-500 mb-1">Dates</h4>
                <p className="font-medium text-slate-900">
                  {new Date(startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {' '}&rarr;{' '}
                  {new Date(endDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-sm text-slate-600">
                  {totalNights} {totalNights === 1 ? 'night' : 'nights'}
                </p>
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
                      <ShieldWarning className="h-3 w-3 mr-1" />
                      Behaviour Concerns
                    </Badge>
                  )}
                  {hasAllergies && (
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      <Warning className="h-3 w-3 mr-1" />
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
                    <CircleNotch className="h-4 w-4 animate-spin" />
                    Calculating...
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatMoney(billingBreakdown?.total || totalNights * 45)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatMoney(billingBreakdown?.pricePerNight || 45)} per night &times; {totalNights} {totalNights === 1 ? 'night' : 'nights'}
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
                    <CircleNotch className="h-4 w-4 animate-spin mr-2" />
                    Creating...
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
