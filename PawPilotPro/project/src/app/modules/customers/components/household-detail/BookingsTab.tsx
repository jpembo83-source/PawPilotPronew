import React, { useEffect, useState } from 'react';
import { useDaycareStore } from '../../../daycare/store';
import { useSettingsStore } from '../../../settings/store';
import { CalendarBlank, Dog, Medal, CreditCard, X, Warning } from '@phosphor-icons/react';

interface BookingsTabProps {
  householdId: string;
}

function statusChip(status: string) {
  switch (status) {
    case 'confirmed':
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Confirmed</span>;
    case 'checked_in':
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Checked in</span>;
    case 'checked_out':
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Completed</span>;
    case 'cancelled':
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">Cancelled</span>;
    case 'no_show':
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">No show</span>;
    default:
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{status}</span>;
  }
}

function parseCancellationWindowHours(rule: string): number {
  if (!rule) return 24;
  const match = rule.trim().match(/^(\d+)\s*(h|d)$/i);
  if (!match) return 24;
  const value = parseInt(match[1], 10);
  return match[2].toLowerCase() === 'd' ? value * 24 : value;
}

function isWithinCancellationWindow(bookingDate: string, windowHours: number): boolean {
  const booking = new Date(bookingDate);
  const now = new Date();
  const diffMs = booking.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < windowHours;
}

const CANCEL_REASONS = [
  { value: 'duplicate', label: 'Duplicate booking' },
  { value: 'customer_request', label: 'Customer request' },
  { value: 'client_cancelled', label: 'Client cancelled' },
  { value: 'staff_error', label: 'Staff error' },
  { value: 'other', label: 'Other' },
];

interface CancelDialogProps {
  booking: any;
  cancellationRule: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

function CancelDialog({ booking, cancellationRule, onConfirm, onClose, isLoading }: CancelDialogProps) {
  const [reason, setReason] = useState('customer_request');
  const [otherText, setOtherText] = useState('');

  const windowHours = parseCancellationWindowHours(cancellationRule);
  const isDuplicate = reason === 'duplicate';
  const isLate = !isDuplicate && isWithinCancellationWindow(booking.booking_date, windowHours);

  const handleConfirm = () => {
    const label = CANCEL_REASONS.find(r => r.value === reason)?.label ?? reason;
    const finalReason = reason === 'other' && otherText.trim() ? otherText.trim() : label;
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-slate-900">Cancel booking</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {booking.pet_name} · {new Date(booking.booking_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Policy info */}
        {!isDuplicate && (
          <div className={`rounded-xl px-3 py-2.5 text-xs flex items-start gap-2 ${isLate ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
            {isLate && <Warning size={14} className="flex-shrink-0 mt-0.5" />}
            <span>
              {isLate
                ? `Late cancellation — booking is within the ${cancellationRule} notice window. A cancellation fee may apply.`
                : `Cancellation policy: ${cancellationRule} notice required.`}
            </span>
          </div>
        )}

        {isDuplicate && (
          <div className="rounded-xl px-3 py-2.5 text-xs bg-blue-50 text-blue-700">
            Duplicate booking — cancellation policy waived.
          </div>
        )}

        {/* Reason selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Reason</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {CANCEL_REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {reason === 'other' && (
            <input
              type="text"
              placeholder="Please specify…"
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Keep booking
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || (reason === 'other' && !otherText.trim())}
            className="flex-1 rounded-xl py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"
          >
            {isLoading ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BookingsTab({ householdId }: BookingsTabProps) {
  const { fetchBookings, cancelBooking } = useDaycareStore();
  const { organisation } = useSettingsStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  const loadBookings = (isStopped?: () => boolean) => {
    fetchBookings({ household_id: householdId })
      .then(() => {
        if (!isStopped?.()) {
          const all = useDaycareStore.getState().bookings;
          setBookings(all.filter(b => b.household_id === householdId));
        }
      })
      .catch(() => {})
      .finally(() => { if (!isStopped?.()) setIsLoading(false); });
  };

  useEffect(() => {
    let stopped = false;
    setIsLoading(true);
    loadBookings(() => stopped);
    return () => { stopped = true; };
  }, [householdId]);

  const handleCancelConfirm = async (reason: string) => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.id);
    try {
      await cancelBooking(cancelTarget.id, reason);
      setBookings(prev => prev.map(b => b.id === cancelTarget.id ? { ...b, booking_status: 'cancelled' } : b));
      setCancelTarget(null);
    } catch {
      // ignore — store already sets error
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <CalendarBlank className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="font-medium text-slate-500">No bookings yet</p>
        <p className="text-sm mt-1">Daycare bookings will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {bookings.map(b => (
          <div key={b.id} className="flex items-center gap-3 p-3 rounded-2xl border bg-white">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-tint)' }}>
              <Dog size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900">{b.pet_name}</p>
                {statusChip(b.booking_status)}
                {b.service_type === 'membership' ? (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}>
                    <Medal size={9} />Member
                  </span>
                ) : (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-0.5">
                    <CreditCard size={9} />PAYG
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(b.booking_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                {b.planned_start_time && ` · ${b.planned_start_time}–${b.planned_end_time}`}
              </p>
            </div>
            {!['cancelled', 'no_show', 'checked_out'].includes(b.booking_status) && (
              <button
                onClick={() => setCancelTarget(b)}
                disabled={cancellingId === b.id}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-40"
                title="Cancel booking"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {cancelTarget && (
        <CancelDialog
          booking={cancelTarget}
          cancellationRule={organisation.cancellationRule || '24h'}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
          isLoading={cancellingId === cancelTarget.id}
        />
      )}
    </>
  );
}
