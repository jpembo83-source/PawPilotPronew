import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Badge } from '../../../../components/ui/badge';
import { Search, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useDaycareStore } from '../../../daycare/store';
import { useDashboardStore } from '../../store';
import { toast } from 'sonner';

interface QuickBookModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickBookModal({ open, onClose }: QuickBookModalProps) {
  const [step, setStep] = useState<'search' | 'select-pet' | 'details'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [searching, setSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { searchCustomers, createBooking } = useDaycareStore();
  const { selectedLocationId, refreshAllWidgets } = useDashboardStore();

  useEffect(() => {
    if (open) {
      // Reset state
      setStep('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedHousehold(null);
      setSelectedPet(null);
      setBookingDate(new Date().toISOString().split('T')[0]);
      setStartTime('08:00');
      setEndTime('17:00');
      setNotes('');
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
      // Auto-select if only one pet
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

  const handleCreateBooking = async () => {
    if (!selectedHousehold || !selectedPet) {
      toast.error('Please select a household and pet');
      return;
    }
    
    if (selectedLocationId === 'ALL') {
      toast.error('Please select a specific location to create a booking');
      return;
    }

    setIsCreating(true);
    
    try {
      await createBooking({
        household_id: selectedHousehold.household_id,
        pet_id: selectedPet.id,
        location_id: selectedLocationId,
        location_name: 'Location',
        service_id: 'service-daycare-full',
        service_name: 'Daycare (Full Day)',
        service_type: 'full_day',
        booking_date: bookingDate,
        planned_start_time: startTime,
        planned_end_time: endTime,
        customer_notes: notes,
      });
      
      toast.success(`Booking created for ${selectedPet.name}`);
      
      // Refresh dashboard widgets
      refreshAllWidgets?.();
      
      // Close modal
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {step === 'search' && 'Quick Book - Search Household'}
            {step === 'select-pet' && 'Quick Book - Select Pet'}
            {step === 'details' && 'Quick Book - Details'}
          </DialogTitle>
          <DialogDescription>
            {step === 'search' && 'Search by household name, pet name, or contact name'}
            {step === 'select-pet' && `Select a pet from ${selectedHousehold?.household_name}`}
            {step === 'details' && `Create booking for ${selectedPet?.name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Search */}
          {step === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search households..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                    autoFocus
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? 'Searching...' : 'Search'}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="border rounded-lg max-h-96 overflow-y-auto divide-y">
                  {searchResults.map((result) => (
                    <button
                      key={result.household_id}
                      onClick={() => handleSelectHousehold(result)}
                      className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{result.household_name}</div>
                          <div className="text-sm text-slate-600 mt-1">
                            {result.pets.length} pet(s)
                            {result.pets.length > 0 && (
                              <span className="text-slate-400"> • {result.pets.map((p: any) => p.name).join(', ')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Pet */}
          {step === 'select-pet' && selectedHousehold && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('search');
                  setSelectedHousehold(null);
                }}
              >
                ← Back to search
              </Button>

              <div className="border rounded-lg divide-y">
                {selectedHousehold.pets.map((pet: any) => (
                  <button
                    key={pet.id}
                    onClick={() => handleSelectPet(pet)}
                    className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {pet.photo_url && (
                        <img
                          src={pet.photo_url}
                          alt={pet.name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium">{pet.name}</div>
                        <div className="text-sm text-slate-600">{pet.breed}</div>
                      </div>
                      {pet.vaccination_status && pet.vaccination_status !== 'up_to_date' && pet.vaccination_status !== 'valid' && (
                        <Badge variant="outline" className={`ml-auto text-xs ${
                          pet.vaccination_status === 'expired' ? 'border-red-500 text-red-600' :
                          pet.vaccination_status === 'expiring_soon' ? 'border-orange-500 text-orange-600' :
                          'border-slate-400 text-slate-500'
                        }`}>
                          {pet.vaccination_status === 'expired' ? 'Vaccination Expired' :
                           pet.vaccination_status === 'expiring_soon' ? 'Vaccination Expiring' :
                           'No Vaccination Records'}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Booking Details */}
          {step === 'details' && selectedPet && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep(selectedHousehold?.pets.length > 1 ? 'select-pet' : 'search');
                  setSelectedPet(null);
                }}
              >
                ← Back
              </Button>

              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center gap-3">
                  {selectedPet.photo_url && (
                    <img
                      src={selectedPet.photo_url}
                      alt={selectedPet.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold">{selectedPet.name}</h3>
                    <p className="text-sm text-slate-600">{selectedHousehold?.household_name}</p>
                  </div>
                </div>
              </div>

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
                  <Label>Service</Label>
                  <Input
                    value="Daycare (Full Day)"
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Start Time
                  </Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">
                    <Clock className="h-3 w-3 inline mr-1" />
                    End Time
                  </Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special requirements or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          {step === 'details' && (
            <Button onClick={handleCreateBooking} disabled={isCreating} className="min-w-32">
              {isCreating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Create Booking
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
