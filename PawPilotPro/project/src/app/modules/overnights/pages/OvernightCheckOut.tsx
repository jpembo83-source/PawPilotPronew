import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useOvernightsStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  MagnifyingGlass,
  SignOut,
  Moon,
  ArrowLeft,
  Pill,
  ShieldWarning,
  Warning,
  ArrowsLeftRight,
  Clock,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { OvernightReservation, CheckOutRequest } from '../types';

export function OvernightCheckOut() {
  const navigate = useNavigate();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const selectedLocation = selectedLocationId !== 'ALL'
    ? locations.find(l => l.id === selectedLocationId)
    : locations[0];
  const {
    reservations,
    isLoading,
    fetchReservations,
    checkOut,
    transitionToDaycare,
  } = useOvernightsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<OvernightReservation | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [handedOverTo, setHandedOverTo] = useState('');
  const [nextVisitNotes, setNextVisitNotes] = useState('');
  const [transitionToDaycareMode, setTransitionToDaycareMode] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (selectedLocation) {
      fetchReservations(selectedLocation.id);
    }
  }, [selectedLocation?.id]);

  const checkedInPets = useMemo(() => {
    return reservations.filter(r =>
      r.status === 'checked_in' || r.status === 'in_stay'
    );
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    if (!searchQuery) return checkedInPets;
    const q = searchQuery.toLowerCase();
    return checkedInPets.filter(r =>
      (r.petName || '').toLowerCase().includes(q) ||
      (r.customerName || '').toLowerCase().includes(q)
    );
  }, [checkedInPets, searchQuery]);

  const calculateStayDuration = (reservation: OvernightReservation) => {
    if (!reservation.actualCheckInTime) return '-';
    const checkInDate = new Date(reservation.actualCheckInTime);
    const now = new Date();
    const hours = Math.floor((now.getTime() - checkInDate.getTime()) / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const handleSelectReservation = (reservation: OvernightReservation) => {
    setSelectedReservation(reservation);
    setCheckOutNotes('');
    setHandedOverTo('');
    setNextVisitNotes('');
    setTransitionToDaycareMode(false);
    setShowDialog(true);
  };

  const handleCheckOut = async () => {
    if (!selectedReservation) return;

    if (transitionToDaycareMode) {
      try {
        await transitionToDaycare(selectedReservation.id);
        toast.success(`${selectedReservation.petName || 'Pet'} transitioned to daycare`);
        setShowDialog(false);
        setSelectedReservation(null);
        if (selectedLocation) {
          fetchReservations(selectedLocation.id);
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to transition to daycare');
      }
      return;
    }

    try {
      const request: CheckOutRequest = {
        reservationId: selectedReservation.id,
        handedOverTo: handedOverTo || 'Owner',
        checkOutNotes: checkOutNotes || undefined,
        nextVisitNotes: nextVisitNotes || undefined,
        checkedOutBy: 'current-user',
      };
      await checkOut(request);
      toast.success(`${selectedReservation.petName || 'Pet'} checked out successfully`);
      setShowDialog(false);
      setSelectedReservation(null);
      if (selectedLocation) {
        fetchReservations(selectedLocation.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out');
    }
  };

  if (!selectedLocation) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <Moon className="h-16 w-16 text-slate-300 mb-4" />
        <h2 className="text-lg font-medium text-slate-900">No Location Selected</h2>
        <p>Please select a location to manage overnight check-outs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/overnights')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <SignOut className="h-6 w-6 text-blue-600" />
            Overnight Check-Out
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Check out pets from overnight boarding at {selectedLocation.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find Pet</CardTitle>
          <CardDescription>Search currently boarding overnight</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search pet or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currently Boarding ({filteredReservations.length})</CardTitle>
          <CardDescription>Pets currently staying overnight</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-8">
              <Moon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No pets currently checked in for overnight boarding</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {(reservation.petName || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{reservation.petName || 'Unknown Pet'}</p>
                      <p className="text-sm text-slate-600">{reservation.customerName || 'Unknown Customer'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          Duration: {calculateStayDuration(reservation)}
                        </span>
                        <span className="text-xs text-slate-400">&middot;</span>
                        <span className="text-xs text-slate-500">
                          Departs: {reservation.endDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {reservation.requiresMedication && (
                      <Badge variant="outline" className="text-xs text-rose-600 border-rose-200">
                        <Pill className="h-3 w-3 mr-1" />
                        Medication
                      </Badge>
                    )}
                    {reservation.hasBehaviourConcerns && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                        <ShieldWarning className="h-3 w-3 mr-1" />
                        Behaviour
                      </Badge>
                    )}
                    {reservation.hasAllergies && (
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                        <Warning className="h-3 w-3 mr-1" />
                        Allergies
                      </Badge>
                    )}
                    {reservation.endDate === today && (
                      <Badge className="text-xs bg-blue-500">
                        Departing Today
                      </Badge>
                    )}
                    <Button onClick={() => handleSelectReservation(reservation)}>
                      <SignOut className="h-4 w-4 mr-2" />
                      Check Out
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Check Out: {selectedReservation?.petName || 'Pet'}
            </DialogTitle>
            <DialogDescription>
              {selectedReservation?.customerName} &middot; Stayed {selectedReservation ? calculateStayDuration(selectedReservation) : '-'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-indigo-900">
                  <ArrowsLeftRight className="h-4 w-4" />
                  Transition to Daycare?
                </div>
                <Switch
                  checked={transitionToDaycareMode}
                  onCheckedChange={setTransitionToDaycareMode}
                />
              </div>
              {transitionToDaycareMode && (
                <p className="text-xs text-indigo-600 ml-6">
                  This will mark the overnight stay as completed and automatically create a daycare booking for today.
                </p>
              )}
            </div>

            {!transitionToDaycareMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="handed-over-to" className="text-sm font-medium text-slate-700">
                    Handed Over To
                  </Label>
                  <Input
                    id="handed-over-to"
                    placeholder="Name of person collecting the pet..."
                    value={handedOverTo}
                    onChange={(e) => setHandedOverTo(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-notes" className="text-sm font-medium text-slate-700">
                    Check-Out Notes (Optional)
                  </Label>
                  <Textarea
                    id="checkout-notes"
                    placeholder="How was their stay? Any incidents or observations..."
                    value={checkOutNotes}
                    onChange={(e) => setCheckOutNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="next-visit-notes" className="text-sm font-medium text-slate-700">
                    Notes for Next Visit (Optional)
                  </Label>
                  <Textarea
                    id="next-visit-notes"
                    placeholder="Anything to note for future stays..."
                    value={nextVisitNotes}
                    onChange={(e) => setNextVisitNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}

            {selectedReservation?.specialInstructions && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Special Instructions</p>
                <p className="text-sm text-slate-700">{selectedReservation.specialInstructions}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckOut} disabled={isLoading}>
              <SignOut className="h-4 w-4 mr-2" />
              {transitionToDaycareMode ? 'Transition to Daycare' : 'Confirm Check-Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
