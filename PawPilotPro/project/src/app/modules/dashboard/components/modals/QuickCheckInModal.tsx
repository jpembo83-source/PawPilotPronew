// Quick Check-in Modal - Supports both single and batch check-in
// Select multiple dogs arriving together (same pickup, same owner)

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Badge } from '../../../../components/ui/badge';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { 
  MagnifyingGlass, 
  Warning, 
  CheckCircle, 
  XCircle, 
  Warning, 
  SignIn, 
  FileText, 
  Syringe,
  UsersThree,
  Check,
  CircleNotch
} from '@phosphor-icons/react';
import { useDaycareStore } from '../../../daycare/store';
import { useDashboardStore } from '../../store';
import { toast } from 'sonner';
import type { DaycareBooking, CheckInValidation } from '../../../daycare/types';

interface QuickCheckInModalProps {
  open: boolean;
  onClose: () => void;
}

interface BatchValidation {
  booking: DaycareBooking;
  validation: CheckInValidation | null;
  isValidating: boolean;
  isCheckedIn: boolean;
}

export function QuickCheckInModal({ open, onClose }: QuickCheckInModalProps) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Single mode state
  const [selectedBooking, setSelectedBooking] = useState<DaycareBooking | null>(null);
  const [validation, setValidation] = useState<CheckInValidation | null>(null);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  // Batch mode state
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [batchValidations, setBatchValidations] = useState<Map<string, BatchValidation>>(new Map());
  const [batchWarningsAcknowledged, setBatchWarningsAcknowledged] = useState(false);
  const [isBatchChecking, setIsBatchChecking] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const { bookings, fetchBookings, validateCheckIn, checkIn } = useDaycareStore();
  const { selectedLocationId, refreshAllWidgets } = useDashboardStore();

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (open) {
      loadTodaysBookings();
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setSearchQuery('');
    setSelectedBooking(null);
    setValidation(null);
    setHandoverNotes('');
    setWarningsAcknowledged(false);
    setSelectedBookings(new Set());
    setBatchValidations(new Map());
    setBatchWarningsAcknowledged(false);
    setMode('single');
  };

  const loadTodaysBookings = async () => {
    try {
      await fetchBookings({
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
        date: today,
        check_in_status: 'not_checked_in',
        booking_status: 'confirmed',
      });
    } catch (err) {
      console.error('Failed to load bookings:', err);
    }
  };

  // Filter bookings based on search
  const filteredBookings = bookings.filter(b => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      b.pet_name.toLowerCase().includes(query) ||
      b.household_name.toLowerCase().includes(query)
    );
  });

  // Group bookings by household for batch selection
  const bookingsByHousehold = filteredBookings.reduce((acc, booking) => {
    const key = booking.household_id || booking.household_name;
    if (!acc[key]) {
      acc[key] = {
        name: booking.household_name,
        bookings: []
      };
    }
    acc[key].bookings.push(booking);
    return acc;
  }, {} as Record<string, { name: string; bookings: DaycareBooking[] }>);

  // Single mode handlers
  const handleSelectBooking = async (booking: DaycareBooking) => {
    setIsValidating(true);
    setSelectedBooking(booking);
    setValidation(null);
    setWarningsAcknowledged(false);
    
    try {
      const result = await validateCheckIn(booking.id);
      setValidation(result);
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Failed to validate check-in');
      setSelectedBooking(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedBooking || !validation) return;
    
    if (!validation.can_check_in) {
      toast.error('Cannot check in due to blockers');
      return;
    }
    
    if (validation.warnings.length > 0 && !warningsAcknowledged) {
      toast.error('Please acknowledge warnings before checking in');
      return;
    }

    setIsChecking(true);
    
    try {
      await checkIn(selectedBooking.id, {
        handover_notes: handoverNotes,
        warnings_acknowledged: warningsAcknowledged,
      });
      
      toast.success(`${selectedBooking.pet_name} checked in successfully`);
      refreshAllWidgets?.();
      onClose();
    } catch (error: any) {
      console.error('Check-in error:', error);
      toast.error(error.message || 'Failed to check in');
    } finally {
      setIsChecking(false);
    }
  };

  // Batch mode handlers
  const toggleBookingSelection = (bookingId: string) => {
    setSelectedBookings(prev => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
  };

  const selectAllFromHousehold = (householdBookings: DaycareBooking[]) => {
    setSelectedBookings(prev => {
      const next = new Set(prev);
      const allSelected = householdBookings.every(b => next.has(b.id));
      
      if (allSelected) {
        // Deselect all
        householdBookings.forEach(b => next.delete(b.id));
      } else {
        // Select all
        householdBookings.forEach(b => next.add(b.id));
      }
      return next;
    });
  };

  const validateBatchSelection = async () => {
    if (selectedBookings.size === 0) return;

    const newValidations = new Map<string, BatchValidation>();
    
    for (const bookingId of selectedBookings) {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) continue;
      
      newValidations.set(bookingId, {
        booking,
        validation: null,
        isValidating: true,
        isCheckedIn: false
      });
    }
    
    setBatchValidations(newValidations);

    // Validate each booking
    for (const bookingId of selectedBookings) {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) continue;
      
      try {
        const result = await validateCheckIn(booking.id);
        setBatchValidations(prev => {
          const next = new Map(prev);
          next.set(bookingId, {
            booking,
            validation: result,
            isValidating: false,
            isCheckedIn: false
          });
          return next;
        });
      } catch (error) {
        console.error(`Validation error for ${booking.pet_name}:`, error);
        setBatchValidations(prev => {
          const next = new Map(prev);
          next.set(bookingId, {
            booking,
            validation: { can_check_in: false, blockers: [{ category: 'system', message: 'Validation failed' }], warnings: [] },
            isValidating: false,
            isCheckedIn: false
          });
          return next;
        });
      }
    }
  };

  const handleBatchCheckIn = async () => {
    const eligibleBookings = Array.from(batchValidations.values())
      .filter(v => v.validation?.can_check_in && !v.isCheckedIn);
    
    if (eligibleBookings.length === 0) {
      toast.error('No eligible bookings to check in');
      return;
    }

    const hasWarnings = eligibleBookings.some(v => (v.validation?.warnings.length || 0) > 0);
    if (hasWarnings && !batchWarningsAcknowledged) {
      toast.error('Please acknowledge warnings before batch check-in');
      return;
    }

    setIsBatchChecking(true);
    setBatchProgress({ current: 0, total: eligibleBookings.length });

    let successCount = 0;
    let failCount = 0;

    for (const { booking } of eligibleBookings) {
      try {
        await checkIn(booking.id, {
          handover_notes: handoverNotes,
          warnings_acknowledged: true,
        });
        
        setBatchValidations(prev => {
          const next = new Map(prev);
          const existing = next.get(booking.id);
          if (existing) {
            next.set(booking.id, { ...existing, isCheckedIn: true });
          }
          return next;
        });
        
        successCount++;
        setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } catch (error) {
        console.error(`Check-in error for ${booking.pet_name}:`, error);
        failCount++;
      }
    }

    setIsBatchChecking(false);

    if (failCount === 0) {
      toast.success(`${successCount} pet${successCount > 1 ? 's' : ''} checked in successfully`);
      refreshAllWidgets?.();
      onClose();
    } else {
      toast.error(`${successCount} succeeded, ${failCount} failed`);
      refreshAllWidgets?.();
    }
  };

  const renderValidationStatus = () => {
    if (!validation) return null;

    return (
      <div className="space-y-3">
        {validation.blockers && validation.blockers.length > 0 && (
          <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900">Check-in Blocked</h4>
                <ul className="mt-2 space-y-1 text-sm text-red-800">
                  {validation.blockers.map((blocker, idx) => (
                    <li key={idx}>• {blocker.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {validation.warnings && validation.warnings.length > 0 && (
          <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded">
            <div className="flex items-start gap-3">
              <Warning className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-orange-900">Warnings</h4>
                <ul className="mt-2 space-y-1 text-sm text-orange-800">
                  {validation.warnings.map((warning, idx) => (
                    <li key={`warning-${idx}-${warning.category}`} className="flex items-start gap-2">
                      {warning.category === 'waiver' && <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      {warning.category === 'vaccination' && <Syringe className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      {warning.category === 'behaviour' && <Warning className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      {warning.category === 'medical' && <Warning className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      <span>{warning.message}</span>
                    </li>
                  ))}
                </ul>
                
                {validation.can_check_in && (
                  <div className="mt-3 flex items-start gap-2">
                    <Checkbox
                      id="acknowledge-warnings"
                      checked={warningsAcknowledged}
                      onCheckedChange={(checked) => setWarningsAcknowledged(checked as boolean)}
                    />
                    <label
                      htmlFor="acknowledge-warnings"
                      className="text-sm text-orange-900 cursor-pointer leading-tight"
                    >
                      I acknowledge these warnings and wish to proceed with check-in
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {validation.can_check_in && validation.warnings.length === 0 && (
          <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-900">Ready for Check-in</h4>
                <p className="mt-1 text-sm text-green-800">No issues detected</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Batch validation summary
  const batchSummary = () => {
    const validations = Array.from(batchValidations.values());
    const canCheckIn = validations.filter(v => v.validation?.can_check_in && !v.isCheckedIn).length;
    const blocked = validations.filter(v => !v.validation?.can_check_in).length;
    const hasWarnings = validations.some(v => (v.validation?.warnings.length || 0) > 0);
    const checkedIn = validations.filter(v => v.isCheckedIn).length;
    
    return { canCheckIn, blocked, hasWarnings, checkedIn, total: validations.length };
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SignIn className="h-5 w-5" />
            Quick Check-in
          </DialogTitle>
          <DialogDescription>
            Check in one pet or multiple pets arriving together
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'batch')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <SignIn className="h-4 w-4" />
              Single Check-in
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <UsersThree className="h-4 w-4" />
              Batch Check-in
            </TabsTrigger>
          </TabsList>

          {/* SINGLE MODE */}
          <TabsContent value="single" className="flex-1 overflow-y-auto space-y-4 mt-4">
            <div>
              <Label>Search Bookings</Label>
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Type pet name or household name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  autoFocus={mode === 'single'}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Showing {filteredBookings.length} booking(s) for today
              </p>
            </div>

            {!selectedBooking && (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {filteredBookings.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <SignIn className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No bookings found</p>
                    <p className="text-sm mt-1">
                      {searchQuery ? `No matches for "${searchQuery}"` : 'No pending check-ins for today'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredBookings.map(booking => (
                      <button
                        key={booking.id}
                        onClick={() => handleSelectBooking(booking)}
                        disabled={isValidating}
                        className="w-full p-3 text-left hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">{booking.pet_name}</div>
                              <div className="text-sm text-slate-600">{booking.household_name}</div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            {booking.has_behaviour_flag && (
                              <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                                Behaviour
                              </Badge>
                            )}
                            {booking.has_medical_flag && (
                              <Badge variant="outline" className="text-xs border-red-500 text-red-600">
                                Medical
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedBooking && (
              <>
                <div className="border rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedBooking.pet_name}</h3>
                      <p className="text-sm text-slate-600">{selectedBooking.household_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedBooking(null);
                        setValidation(null);
                        setWarningsAcknowledged(false);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </div>

                {isValidating ? (
                  <div className="flex items-center justify-center p-8">
                    <CircleNotch className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="ml-3 text-sm text-slate-600">Validating...</p>
                  </div>
                ) : (
                  renderValidationStatus()
                )}

                {validation && validation.can_check_in && (
                  <div>
                    <Label htmlFor="handover-notes">Handover Notes (Optional)</Label>
                    <Textarea
                      id="handover-notes"
                      placeholder="Any notes to record at check-in..."
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* BATCH MODE */}
          <TabsContent value="batch" className="flex-1 overflow-y-auto space-y-4 mt-4">
            <div>
              <Label>Search & Select Multiple</Label>
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by pet or household..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selectedBookings.size > 0 && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  {selectedBookings.size} pet{selectedBookings.size > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {batchValidations.size === 0 ? (
              // Selection mode
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {Object.entries(bookingsByHousehold).length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <UsersThree className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No bookings found</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {Object.entries(bookingsByHousehold).map(([householdKey, { name, bookings: householdBookings }]) => (
                      <div key={householdKey} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-700">{name}</span>
                          {householdBookings.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => selectAllFromHousehold(householdBookings)}
                            >
                              {householdBookings.every(b => selectedBookings.has(b.id)) 
                                ? 'Deselect All' 
                                : 'Select All'}
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {householdBookings.map(booking => (
                            <label
                              key={booking.id}
                              className={`
                                flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                                ${selectedBookings.has(booking.id) 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-slate-50'}
                              `}
                            >
                              <Checkbox
                                checked={selectedBookings.has(booking.id)}
                                onCheckedChange={() => toggleBookingSelection(booking.id)}
                              />
                              <span className="flex-1">{booking.pet_name}</span>
                              <div className="flex gap-1">
                                {booking.has_behaviour_flag && (
                                  <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                                    B
                                  </Badge>
                                )}
                                {booking.has_medical_flag && (
                                  <Badge variant="outline" className="text-xs border-red-500 text-red-600">
                                    M
                                  </Badge>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Validation results mode
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-700">{batchSummary().canCheckIn}</div>
                    <div className="text-xs text-green-600">Ready</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-700">{batchSummary().blocked}</div>
                    <div className="text-xs text-red-600">Blocked</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-700">{batchSummary().checkedIn}</div>
                    <div className="text-xs text-blue-600">Done</div>
                  </div>
                </div>

                {/* Individual results */}
                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {Array.from(batchValidations.values()).map(({ booking, validation, isValidating, isCheckedIn }) => (
                    <div key={booking.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isCheckedIn ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : isValidating ? (
                          <CircleNotch className="h-5 w-5 animate-spin text-blue-500" />
                        ) : validation?.can_check_in ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className={isCheckedIn ? 'line-through text-slate-400' : ''}>
                          {booking.pet_name}
                        </span>
                      </div>
                      {validation?.warnings && validation.warnings.length > 0 && !isCheckedIn && (
                        <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                          {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {batchSummary().hasWarnings && batchSummary().canCheckIn > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <Checkbox
                      id="batch-acknowledge"
                      checked={batchWarningsAcknowledged}
                      onCheckedChange={(checked) => setBatchWarningsAcknowledged(checked as boolean)}
                    />
                    <label
                      htmlFor="batch-acknowledge"
                      className="text-sm text-orange-900 cursor-pointer"
                    >
                      I acknowledge all warnings and wish to proceed with batch check-in
                    </label>
                  </div>
                )}

                <div>
                  <Label htmlFor="batch-notes">Handover Notes (Optional)</Label>
                  <Textarea
                    id="batch-notes"
                    placeholder="Notes for all pets..."
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>

                {isBatchChecking && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">Checking in...</span>
                      <span className="text-sm text-blue-700">
                        {batchProgress.current}/{batchProgress.total}
                      </span>
                    </div>
                    <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isChecking || isBatchChecking}>
            Cancel
          </Button>
          
          {mode === 'single' && selectedBooking && validation && validation.can_check_in && (
            <Button 
              onClick={handleCheckIn} 
              disabled={isChecking || (validation.warnings.length > 0 && !warningsAcknowledged)}
            >
              {isChecking ? (
                <><CircleNotch className="h-4 w-4 mr-2 animate-spin" />Checking in...</>
              ) : (
                <><SignIn className="h-4 w-4 mr-2" />Check In</>
              )}
            </Button>
          )}
          
          {mode === 'batch' && batchValidations.size === 0 && selectedBookings.size > 0 && (
            <Button onClick={validateBatchSelection}>
              <Check className="h-4 w-4 mr-2" />
              Validate {selectedBookings.size} Pet{selectedBookings.size > 1 ? 's' : ''}
            </Button>
          )}
          
          {mode === 'batch' && batchValidations.size > 0 && batchSummary().canCheckIn > 0 && (
            <Button 
              onClick={handleBatchCheckIn}
              disabled={isBatchChecking || (batchSummary().hasWarnings && !batchWarningsAcknowledged)}
            >
              {isBatchChecking ? (
                <><CircleNotch className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><UsersThree className="h-4 w-4 mr-2" />Check In {batchSummary().canCheckIn} Pet{batchSummary().canCheckIn > 1 ? 's' : ''}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
