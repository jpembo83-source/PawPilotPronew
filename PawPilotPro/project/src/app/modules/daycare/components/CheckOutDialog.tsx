// Check-out dialog — mood, notes for the owner, and share-a-moment.
// Extracted from DaycareCheckOut so other surfaces (global search) reuse the
// exact same dialog and logic.

import React, { useEffect, useState } from 'react';
import { useDaycareStore } from '../store';
import { Dialog, DialogContent } from '../../../components/ui/dialog';
import { Textarea } from '../../../components/ui/textarea';
import {
  Clock,
  SignOut,
  Warning,
  FirstAidKit,
  Smiley,
  SmileyMeh,
  SmileySad,
  Camera,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { ShareMomentModal, type ShareMomentPet } from './ShareMomentModal';
import { useConnectivity } from '../../../hooks/useConnectivity';
import type { DaycareBooking } from '../types';

type Mood = 'great' | 'good' | 'tired';

const MOOD_OPTIONS: { value: Mood; label: string; Icon: React.ElementType; colour: string }[] = [
  { value: 'great', label: 'Great day', Icon: Smiley,    colour: '#16A34A' },
  { value: 'good',  label: 'Good day',  Icon: SmileyMeh, colour: '#D97706' },
  { value: 'tired', label: 'Tired',     Icon: SmileySad, colour: '#6B7280' },
];

export function formatDuration(checkInIso: string): string {
  const checkIn = new Date(checkInIso);
  if (isNaN(checkIn.getTime())) return '—';
  const minutes = Math.floor((Date.now() - checkIn.getTime()) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface CheckOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: DaycareBooking | null;
  /** Called after a successful check-out (dialog already closed). */
  onCheckedOut?: () => void | Promise<void>;
}

export function CheckOutDialog({ open, onOpenChange, booking, onCheckedOut }: CheckOutDialogProps) {
  const { checkOut } = useDaycareStore();
  const isOnline = useConnectivity();

  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [mood, setMood]                   = useState<Mood | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [momentPet, setMomentPet]         = useState<ShareMomentPet | null>(null);

  // Fresh mood/notes each time the dialog opens
  useEffect(() => {
    if (open) { setCheckoutNotes(''); setMood(null); }
  }, [open]);

  const handleCheckOut = async () => {
    if (!booking) return;
    setSubmitting(true);
    try {
      const notes = [
        mood ? `Mood: ${MOOD_OPTIONS.find(m => m.value === mood)?.label}` : null,
        checkoutNotes.trim() || null,
      ].filter(Boolean).join('\n');

      await checkOut(booking.id, notes || undefined);
      toast.success(`${booking.pet_name} checked out`);
      onOpenChange(false);
      await onCheckedOut?.();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to check out');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden">

          {/* Header — mirrors check-in style */}
          <div className="px-6 pt-6 pb-5 flex items-center gap-4" style={{ background: 'var(--primary-tint)' }}>
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'var(--primary)' }}
            >
              {booking?.pet_photo_url ? (
                <img src={booking.pet_photo_url} alt={booking.pet_name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-white">
                  {booking?.pet_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#1C1916] leading-tight">{booking?.pet_name}</h2>
              <p className="text-sm text-[#6B6762] truncate">{booking?.household_name}</p>

              {/* Duration strip */}
              {booking?.actual_check_in_time && (
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-[#6B6762]" />
                    <span className="text-xs text-[#6B6762]">
                      In {formatTime(booking.actual_check_in_time)}
                    </span>
                  </div>
                  <span
                    className="text-sm font-bold"
                    style={{ color: 'var(--primary)' }}
                  >
                    {formatDuration(booking.actual_check_in_time)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Flags — alert message text alongside the icon, same pattern as
                the check-in dialog's validation warnings. Safety-critical
                text renders at text-sm minimum, and a flag without notes is
                still surfaced rather than silently hidden. */}
            {(booking?.has_behaviour_flag || booking?.has_medical_flag) && (
              <div className="space-y-2">
                {booking?.has_behaviour_flag && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <Warning size={15} weight="fill" className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      {booking.behaviour_notes?.trim() || 'Behaviour flag on file — see pet profile for details.'}
                    </p>
                  </div>
                )}
                {booking?.has_medical_flag && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <FirstAidKit size={15} weight="fill" className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800">
                      {booking.medical_notes?.trim() || 'Medical flag on file — see pet profile for details.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mood picker */}
            <div>
              <p className="text-sm font-medium text-[#1C1916] mb-2">How was their day?</p>
              <div className="grid grid-cols-3 gap-2">
                {MOOD_OPTIONS.map(({ value, label, Icon, colour }) => (
                  <button
                    key={value}
                    onClick={() => setMood(mood === value ? null : value)}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-3 border transition-all"
                    style={{
                      background: mood === value ? `${colour}14` : '#FAFAF8',
                      borderColor: mood === value ? colour : '#E2DED8',
                    }}
                  >
                    <Icon size={22} weight={mood === value ? 'fill' : 'regular'} style={{ color: colour }} />
                    <span className="text-xs font-medium" style={{ color: mood === value ? colour : '#6B6762' }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-[#1C1916] block mb-1.5">
                Notes for the owner <span className="text-tertiary-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Anything the owner should know…"
                value={checkoutNotes}
                onChange={e => setCheckoutNotes(e.target.value)}
                rows={3}
                className="resize-none text-base md:text-sm rounded-xl border-[#E2DED8] bg-[#F4F3EF] placeholder:text-tertiary-foreground focus:border-primary focus:ring-primary/10"
              />
            </div>

            {/* Share a moment — photo + one-liner to the owner's feed */}
            <button
              onClick={() => booking && setMomentPet({
                id: booking.pet_id,
                name: booking.pet_name,
                householdId: booking.household_id,
                bookingId: booking.id,
              })}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}
            >
              <Camera size={16} weight="duotone" />
              Share a moment with the owner
            </button>
          </div>

          {/* Footer */}
          {!isOnline && (
            <p className="text-xs text-red-700 text-center px-6 pb-2 -mt-2">
              You're offline — this check-out can't be saved right now.
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
              onClick={() => void handleCheckOut()}
              disabled={submitting || !isOnline}
              className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity"
              style={{ background: 'var(--primary)' }}
            >
              <SignOut size={16} weight="bold" />
              {submitting ? 'Checking out…' : `Check Out ${booking?.pet_name}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ShareMomentModal open={momentPet !== null} onClose={() => setMomentPet(null)} pet={momentPet} />
    </>
  );
}
