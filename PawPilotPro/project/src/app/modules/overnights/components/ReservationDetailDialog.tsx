import React, { useState, useEffect } from 'react';
import { Moon, Pill, ShieldWarning, Warning, XCircle, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useOvernightsStore } from '../store';
import { STATUS_CONFIG, CANCELLABLE_STATUSES } from '../constants';
import { EventTimeline } from './EventTimeline';
import { formatCurrency } from '../../../utils/currency';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import type { OvernightReservation } from '../types';

interface ReservationDetailDialogProps {
  reservation: OvernightReservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a mutation (e.g. cancellation) so the parent list refreshes. */
  onChanged?: () => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ReservationDetailDialog({ reservation, open, onOpenChange, onChanged }: ReservationDetailDialogProps) {
  const { cancelReservation } = useOvernightsStore();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowCancelForm(false);
      setCancelReason('');
    }
  }, [open]);

  if (!reservation) return null;

  const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.booked;
  const canCancel = CANCELLABLE_STATUSES.includes(reservation.status);

  const handleCancel = async () => {
    if (cancelReason.trim().length < 3) {
      toast.error('Please give a short reason for the cancellation');
      return;
    }
    setCancelling(true);
    try {
      await cancelReservation(reservation.id, cancelReason.trim());
      toast.success(`Reservation for ${reservation.petName || 'pet'} cancelled`);
      onOpenChange(false);
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel reservation');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-primary" />
            {reservation.petName || 'Reservation'}
            <Badge variant="outline" className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {reservation.customerName || 'Unknown customer'} &middot; {reservation.totalNights}{' '}
            {reservation.totalNights === 1 ? 'night' : 'nights'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg divide-y">
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Check-in</p>
                <p className="text-sm text-foreground">{formatDate(reservation.startDate)}</p>
                <p className="text-sm text-muted-foreground">
                  {reservation.checkInWindow ? `${reservation.checkInWindow.start}–${reservation.checkInWindow.end}` : ''}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Check-out</p>
                <p className="text-sm text-foreground">{formatDate(reservation.endDate)}</p>
                <p className="text-sm text-muted-foreground">
                  {reservation.checkOutWindow ? `${reservation.checkOutWindow.start}–${reservation.checkOutWindow.end}` : ''}
                </p>
              </div>
            </div>

            <div className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Price</p>
              <p className="text-sm text-foreground font-medium">
                {formatCurrency(reservation.totalPrice ?? 0, reservation.currency)}
                <span className="font-normal text-muted-foreground">
                  {' '}({formatCurrency(reservation.pricePerNight ?? 0, reservation.currency)} per night)
                </span>
              </p>
            </div>

            <div className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Flags</p>
              <div className="flex flex-wrap gap-2">
                {reservation.requiresMedication && (
                  <Badge variant="outline" className="text-rose-600 border-rose-200">
                    <Pill className="h-3 w-3 mr-1" />
                    Medication Required
                  </Badge>
                )}
                {reservation.hasBehaviourConcerns && (
                  <Badge variant="outline" className="text-amber-600 border-amber-200">
                    <ShieldWarning className="h-3 w-3 mr-1" />
                    Behaviour Concerns
                  </Badge>
                )}
                {reservation.hasAllergies && (
                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                    <Warning className="h-3 w-3 mr-1" />
                    Allergies
                  </Badge>
                )}
                {!reservation.requiresMedication && !reservation.hasBehaviourConcerns && !reservation.hasAllergies && (
                  <span className="text-sm text-muted-foreground">No flags</span>
                )}
              </div>
            </div>

            {(reservation.specialInstructions || reservation.feedingInstructions || reservation.medicationInstructions || reservation.behaviourNotes) && (
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                {reservation.specialInstructions && (
                  <p className="text-sm text-foreground"><span className="font-medium">Special:</span> {reservation.specialInstructions}</p>
                )}
                {reservation.feedingInstructions && (
                  <p className="text-sm text-foreground"><span className="font-medium">Feeding:</span> {reservation.feedingInstructions}</p>
                )}
                {reservation.medicationInstructions && (
                  <p className="text-sm text-foreground"><span className="font-medium">Medication:</span> {reservation.medicationInstructions}</p>
                )}
                {reservation.behaviourNotes && (
                  <p className="text-sm text-foreground"><span className="font-medium">Behaviour:</span> {reservation.behaviourNotes}</p>
                )}
              </div>
            )}

            {reservation.status === 'cancelled' && reservation.cancellationReason && (
              <div className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-1">Cancellation Reason</p>
                <p className="text-sm text-foreground">{reservation.cancellationReason}</p>
              </div>
            )}
          </div>

          {canCancel && (
            <div className="border border-red-200 rounded-lg p-4 space-y-3">
              {!showCancelForm ? (
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowCancelForm(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Reservation
                </Button>
              ) : (
                <>
                  <Label htmlFor="cancel-reason" className="text-sm font-medium text-red-900">
                    Reason for cancellation
                  </Label>
                  <Textarea
                    id="cancel-reason"
                    placeholder="e.g. owner's travel plans changed…"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowCancelForm(false)} disabled={cancelling}>
                      Keep Reservation
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => { void handleCancel(); }}
                      disabled={cancelling}
                    >
                      {cancelling ? (
                        <>
                          <CircleNotch className="h-4 w-4 animate-spin mr-2" />
                          Cancelling…
                        </>
                      ) : (
                        'Confirm Cancellation'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="border rounded-lg p-4">
            <EventTimeline stayId={reservation.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
