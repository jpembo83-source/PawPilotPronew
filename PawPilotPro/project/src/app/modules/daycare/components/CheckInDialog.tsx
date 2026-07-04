// Check-in validation dialog — the single-dog check-in flow.
// Extracted from DaycareCheckIn so other surfaces (global search) reuse the
// exact same dialog and logic. The host validates first (validateCheckIn),
// then opens this dialog with the booking + validation result.

import React, { useEffect, useState } from 'react';
import { useDaycareStore } from '../store';
import { Dialog, DialogContent } from '../../../components/ui/dialog';
import { Textarea } from '../../../components/ui/textarea';
import { Checkbox } from '../../../components/ui/checkbox';
import { SignIn, Warning, XCircle, CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useConnectivity } from '../../../hooks/useConnectivity';
import type { DaycareBooking, CheckInValidation } from '../types';

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: DaycareBooking | null;
  validation: CheckInValidation | null;
  /** Called after a successful check-in (dialog already closed). */
  onCheckedIn?: () => void | Promise<void>;
}

export function CheckInDialog({ open, onOpenChange, booking, validation, onCheckedIn }: CheckInDialogProps) {
  const { checkIn } = useDaycareStore();
  const isOnline = useConnectivity();

  const [handoverNotes, setHandoverNotes]      = useState('');
  const [warningsAcknowledged, setWarningsAck] = useState(false);
  const [submitting, setSubmitting]            = useState(false);

  // Fresh notes/acknowledgement each time the dialog opens
  useEffect(() => {
    if (open) { setHandoverNotes(''); setWarningsAck(false); }
  }, [open]);

  const handleCheckIn = async () => {
    if (!booking || !validation) return;
    if (!validation.can_check_in) { toast.error('Cannot check in — blockers must be resolved'); return; }
    if (validation.warnings.length > 0 && !warningsAcknowledged) {
      toast.error('Acknowledge warnings before checking in');
      return;
    }
    setSubmitting(true);
    try {
      await checkIn(booking.id, {
        handover_notes:       handoverNotes,
        warnings_acknowledged: warningsAcknowledged,
      });
      toast.success(`${booking.pet_name} checked in`);
      onOpenChange(false);
      await onCheckedIn?.();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to check in');
    } finally {
      setSubmitting(false);
    }
  };

  const canConfirm = !!validation?.can_check_in &&
    (validation.warnings.length === 0 || warningsAcknowledged) &&
    !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-center gap-4" style={{ background: 'var(--primary-tint)' }}>
          <div
            className="h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <span className="text-xl font-bold text-white">
              {booking?.pet_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#1C1916] leading-tight">
              {booking?.pet_name}
            </h2>
            <p className="text-sm text-[#6B6762] truncate">{booking?.household_name}</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Blockers */}
          {validation?.blockers && validation.blockers.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={16} weight="fill" className="text-red-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-red-800">Cannot Check In</span>
              </div>
              <ul className="space-y-1 pl-6">
                {validation.blockers.map((b, i) => (
                  <li key={i} className="text-sm text-red-700 list-disc">{b.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validation?.warnings && validation.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Warning size={16} weight="fill" className="text-amber-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-amber-800">Warnings</span>
              </div>
              <ul className="space-y-1 pl-6 mb-3">
                {validation.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-700 list-disc">{w.message}</li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
                <Checkbox
                  id="ack-warnings"
                  checked={warningsAcknowledged}
                  onCheckedChange={v => setWarningsAck(v as boolean)}
                />
                <label htmlFor="ack-warnings" className="text-sm font-medium text-amber-900 cursor-pointer">
                  I acknowledge these warnings
                </label>
              </div>
            </div>
          )}

          {/* All clear */}
          {validation?.can_check_in &&
            !validation.blockers?.length &&
            !validation.warnings?.length && (
            <div
              className="border rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'var(--primary-tint)', borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)' }}
            >
              <CheckCircle size={18} weight="fill" style={{ color: 'var(--primary)' }} className="flex-shrink-0" />
              <span className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                Ready to check in
              </span>
            </div>
          )}

          {/* Handover notes */}
          {validation?.can_check_in && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#1C1916]">
                Handover notes <span className="text-tertiary-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Any notes from the owner…"
                value={handoverNotes}
                onChange={e => setHandoverNotes(e.target.value)}
                rows={3}
                className="resize-none text-base md:text-sm rounded-xl border-[#E2DED8] bg-[#F4F3EF] placeholder:text-tertiary-foreground focus:border-primary focus:ring-primary/10"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {!isOnline && (
          <p className="text-xs text-red-700 text-center px-6 pb-2 -mt-2">
            You're offline — this check-in can't be saved right now.
          </p>
        )}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 rounded-xl border border-[#E2DED8] text-[#1C1916] text-sm font-medium hover:bg-[#F4F3EF] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCheckIn()}
            disabled={!canConfirm || !isOnline}
            className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity"
            style={{ background: 'var(--primary)' }}
          >
            <SignIn size={16} weight="bold" />
            {submitting ? 'Checking in…' : `Check In ${booking?.pet_name}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
