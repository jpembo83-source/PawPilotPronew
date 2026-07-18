import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useOvernightsStore } from '../store';
import { useOvernightLocation } from '../hooks/useOvernightLocation';
import { LocationPrompt } from '../components/LocationPrompt';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
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
  SignIn,
  ArrowLeft,
  Warning,
  XCircle,
  CheckCircle,
  Pill,
  ShieldWarning,
  Syringe,
  FileDashed,
  ArrowsLeftRight,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { OvernightReservation, CheckInRequest, CheckInValidation } from '../types';

import { useBackNavigation } from '../../../components/BackButton';
export function OvernightCheckIn() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/overnights');
  const { location: selectedLocation, needsSelection } = useOvernightLocation();
  const {
    reservations,
    isLoading,
    fetchReservations,
    checkIn,
    transitionFromDaycare,
    validateCheckIn,
  } = useOvernightsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<OvernightReservation | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const [handoverNotes, setHandoverNotes] = useState('');
  const [vaccinationValid, setVaccinationValid] = useState(false);
  const [waiverSigned, setWaiverSigned] = useState(false);
  const [behaviourAcknowledged, setBehaviourAcknowledged] = useState(false);
  const [medicalAcknowledged, setMedicalAcknowledged] = useState(false);

  const [transitionFromDaycareMode, setTransitionFromDaycareMode] = useState(false);

  // Server-computed readiness (holds, vaccination, waiver) for the selected
  // reservation. The server re-enforces blockers at check-in, so a failed
  // lookup degrades to attestation-only rather than blocking the desk.
  const [validation, setValidation] = useState<CheckInValidation | null>(null);
  const [validating, setValidating] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (selectedLocation) {
      fetchReservations(selectedLocation.id);
    }
  }, [selectedLocation?.id]);

  const checkInsToday = useMemo(() => {
    return reservations.filter(r =>
      r.startDate === today &&
      (r.status === 'confirmed' || r.status === 'booked')
    );
  }, [reservations, today]);

  const filteredReservations = useMemo(() => {
    if (!searchQuery) return checkInsToday;
    const q = searchQuery.toLowerCase();
    return checkInsToday.filter(r =>
      (r.petName || '').toLowerCase().includes(q) ||
      (r.customerName || '').toLowerCase().includes(q)
    );
  }, [checkInsToday, searchQuery]);

  const handleSelectReservation = (reservation: OvernightReservation) => {
    setSelectedReservation(reservation);
    setHandoverNotes('');
    setVaccinationValid(false);
    setWaiverSigned(false);
    setBehaviourAcknowledged(false);
    setMedicalAcknowledged(false);
    setTransitionFromDaycareMode(false);
    setShowDialog(true);

    setValidation(null);
    setValidating(true);
    validateCheckIn(reservation.id)
      .then(setValidation)
      .catch(() => {
        setValidation(null);
        toast.warning('Could not verify records — check-in will rely on your confirmations below.');
      })
      .finally(() => setValidating(false));
  };

  // Live pet flags (from validation) win over the reservation snapshot —
  // safety notes added after booking must still reach this screen.
  const effectiveMedication = validation?.requiresMedication ?? selectedReservation?.requiresMedication ?? false;
  const effectiveBehaviour = validation?.hasBehaviourConcerns ?? selectedReservation?.hasBehaviourConcerns ?? false;
  const effectiveAllergies = validation?.hasAllergies ?? selectedReservation?.hasAllergies ?? false;

  const blockers = validation?.blockers ?? [];
  const warnings: { category: string; message: string }[] = [
    ...(validation?.warnings ?? []),
  ];
  if (effectiveBehaviour) {
    warnings.push({ category: 'behaviour', message: 'This pet has behaviour concerns noted. Please review before check-in.' });
  }
  if (effectiveMedication) {
    warnings.push({ category: 'medication', message: 'This pet requires medication during their stay.' });
  }
  if (effectiveAllergies) {
    warnings.push({ category: 'allergies', message: 'This pet has known allergies. Ensure care plan is in place.' });
  }
  const hasBlockers = blockers.length > 0;
  const hasWarnings = warnings.length > 0;

  const canCheckIn =
    !hasBlockers &&
    !validating &&
    vaccinationValid &&
    waiverSigned &&
    (!effectiveBehaviour || behaviourAcknowledged) &&
    (!effectiveMedication || medicalAcknowledged);

  const handleCheckIn = async () => {
    if (!selectedReservation) return;

    if (transitionFromDaycareMode) {
      try {
        await transitionFromDaycare({
          type: 'daycare_to_overnight',
          petId: selectedReservation.petId,
          locationId: selectedReservation.locationId,
          reservationId: selectedReservation.id,
          assignedCarerUserId: selectedReservation.assignedCarerUserId,
        });
        toast.success(`${selectedReservation.petName || 'Pet'} transitioned from daycare and checked in for overnight stay`);
        setShowDialog(false);
        setSelectedReservation(null);
        if (selectedLocation) {
          fetchReservations(selectedLocation.id);
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to transition from daycare');
      }
      return;
    }

    try {
      const request: CheckInRequest = {
        reservationId: selectedReservation.id,
        vaccinationValid,
        waiverSigned,
        behaviourWarningsAcknowledged: behaviourAcknowledged,
        medicalWarningsAcknowledged: medicalAcknowledged,
        checkInNotes: handoverNotes || undefined,
        checkedInBy: 'current-user',
      };
      await checkIn(request);
      toast.success(`${selectedReservation.petName || 'Pet'} checked in successfully for overnight stay`);
      setShowDialog(false);
      setSelectedReservation(null);
      if (selectedLocation) {
        fetchReservations(selectedLocation.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
    }
  };

  if (!selectedLocation) {
    return <LocationPrompt needsSelection={needsSelection} action="manage overnight check-ins" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <SignIn className="h-6 w-6 text-emerald-600" />
            Overnight Check-In
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Check in pets for overnight boarding at {selectedLocation.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find Reservation</CardTitle>
          <CardDescription>Search by pet name or customer</CardDescription>
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
          <CardTitle>Ready for Check-In ({filteredReservations.length})</CardTitle>
          <CardDescription>Confirmed reservations for today</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading reservations...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-8">
              <SignIn className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No reservations ready for check-in today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectReservation(reservation)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {(reservation.petName || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{reservation.petName || 'Unknown Pet'}</p>
                      <p className="text-sm text-slate-600">{reservation.customerName || 'Unknown Customer'}</p>
                      <p className="text-xs text-slate-400">
                        {reservation.totalNights} night{reservation.totalNights !== 1 ? 's' : ''} &middot; {reservation.startDate} to {reservation.endDate}
                      </p>
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
                    <Button size="sm">
                      <SignIn className="h-4 w-4 mr-2" />
                      Check In
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
              Check In: {selectedReservation?.petName || 'Pet'}
            </DialogTitle>
            <DialogDescription>
              {selectedReservation?.customerName} &middot; {selectedReservation?.totalNights} night{(selectedReservation?.totalNights ?? 0) !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {hasBlockers && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-red-900 font-medium">
                  <XCircle className="h-5 w-5" />
                  Blockers — Cannot Check In
                </div>
                {blockers.map((blocker, index) => (
                  <div key={index} className="flex items-start gap-2 ml-7 text-sm text-red-700">
                    <span>&bull;</span>
                    <span>{blocker.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="font-medium text-slate-900 flex items-center gap-2">
                <Syringe className="h-4 w-4" />
                Validation Checks
              </div>
              <div className="flex items-center gap-3 ml-6">
                <Checkbox
                  id="vaccination-valid"
                  checked={vaccinationValid}
                  onCheckedChange={(checked) => setVaccinationValid(checked as boolean)}
                />
                <label htmlFor="vaccination-valid" className="text-sm cursor-pointer">
                  Vaccinations are valid and up to date
                </label>
              </div>
              <div className="flex items-center gap-3 ml-6">
                <Checkbox
                  id="waiver-signed"
                  checked={waiverSigned}
                  onCheckedChange={(checked) => setWaiverSigned(checked as boolean)}
                />
                <label htmlFor="waiver-signed" className="text-sm cursor-pointer">
                  Waiver has been signed by the owner
                </label>
              </div>
              {validating && (
                <p className="text-sm text-slate-500 ml-6">Checking vaccination and waiver records…</p>
              )}
              {validation && (
                <p className="text-sm text-slate-500 ml-6">
                  On record: vaccination {validation.vaccinationStatus.replace(/_/g, ' ')} &middot; waiver {validation.waiverStatus.replace(/_/g, ' ')}
                </p>
              )}
            </div>

            {hasWarnings && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-medium">
                  <Warning className="h-5 w-5" />
                  Warnings — Acknowledgement Required
                </div>
                {warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-2 ml-7 text-sm text-amber-700">
                    <span>&bull;</span>
                    <span>{warning.message}</span>
                  </div>
                ))}
                {effectiveBehaviour && (
                  <div className="flex items-center gap-3 ml-6 pt-1">
                    <Checkbox
                      id="behaviour-ack"
                      checked={behaviourAcknowledged}
                      onCheckedChange={(checked) => setBehaviourAcknowledged(checked as boolean)}
                    />
                    <label htmlFor="behaviour-ack" className="text-sm font-medium text-amber-900 cursor-pointer">
                      I acknowledge the behaviour warnings
                    </label>
                  </div>
                )}
                {effectiveMedication && (
                  <div className="flex items-center gap-3 ml-6 pt-1">
                    <Checkbox
                      id="medical-ack"
                      checked={medicalAcknowledged}
                      onCheckedChange={(checked) => setMedicalAcknowledged(checked as boolean)}
                    />
                    <label htmlFor="medical-ack" className="text-sm font-medium text-amber-900 cursor-pointer">
                      I acknowledge the medication requirements
                    </label>
                  </div>
                )}
              </div>
            )}

            {!hasBlockers && !hasWarnings && vaccinationValid && waiverSigned && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-900 font-medium">
                  <CheckCircle className="h-5 w-5" />
                  Ready to Check In
                </div>
                <p className="text-sm text-green-700 ml-7 mt-1">
                  No issues detected. Ready to proceed.
                </p>
              </div>
            )}

            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-indigo-900">
                  <ArrowsLeftRight className="h-4 w-4" />
                  Transitioning from Daycare?
                </div>
                <Switch
                  checked={transitionFromDaycareMode}
                  onCheckedChange={setTransitionFromDaycareMode}
                />
              </div>
              {transitionFromDaycareMode && (
                <p className="text-sm text-indigo-700 ml-6">
                  The pet's active daycare attendance at this location will be found and
                  closed automatically, and the pet checked in for the overnight stay.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="handover-notes" className="text-sm font-medium text-slate-700">
                Handover Notes (Optional)
              </Label>
              <Textarea
                id="handover-notes"
                placeholder="Any important information for the overnight team..."
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                rows={3}
              />
            </div>

            {selectedReservation?.specialInstructions && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Special Instructions</p>
                <p className="text-sm text-slate-700">{selectedReservation.specialInstructions}</p>
              </div>
            )}
            {selectedReservation?.feedingInstructions && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Feeding Instructions</p>
                <p className="text-sm text-slate-700">{selectedReservation.feedingInstructions}</p>
              </div>
            )}
            {selectedReservation?.medicationInstructions && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Medication Instructions</p>
                <p className="text-sm text-slate-700">{selectedReservation.medicationInstructions}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckIn}
              disabled={(!transitionFromDaycareMode && !canCheckIn) || isLoading}
            >
              <SignIn className="h-4 w-4 mr-2" />
              {transitionFromDaycareMode
                ? 'Transition & Check In'
                : canCheckIn
                  ? 'Confirm Check-In'
                  : 'Cannot Check In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
