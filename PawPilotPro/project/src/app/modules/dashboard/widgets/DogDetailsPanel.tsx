// Dog Details Panel - Check-in/out actions for Today's Daycare Dogs
// Side panel for viewing booking details and performing check-in/out actions

import React, { useState, useEffect } from 'react';
import { X, Dog, Warning, FileDashed, Prohibit, Pulse, Clock, CheckCircle, SignOut, ChatTeardrop, FileText } from '@phosphor-icons/react';
import { useDaycareStore } from '../../daycare/store';
import { useAuth } from '../../../context/AuthContext';
import { cn } from '../../../components/ui/utils';
import type { DaycareBooking, CheckInValidation } from '../../daycare/types';
import { toast } from 'sonner';

interface DogDetailsPanelProps {
  booking: DaycareBooking | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

export function DogDetailsPanel({ booking, isOpen, onClose, onActionComplete }: DogDetailsPanelProps) {
  const [validation, setValidation] = useState<CheckInValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);

  const { validateCheckIn, checkIn, checkOut } = useDaycareStore();
  const { user, hasPermission } = useAuth();

  // Reset state when booking changes
  useEffect(() => {
    if (booking) {
      setHandoverNotes('');
      setCheckoutNotes('');
      setWarningsAcknowledged(false);
      
      // Auto-validate if not checked in
      if (booking.check_in_status === 'not_checked_in') {
        performValidation();
      } else {
        setValidation(null);
      }
    }
  }, [booking?.id]);

  const performValidation = async () => {
    if (!booking) return;

    setIsValidating(true);
    try {
      const result = await validateCheckIn(booking.id);
      setValidation(result);
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error('Failed to validate check-in requirements');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCheckIn = async () => {
    if (!booking || !validation) return;

    // Check permissions
    if (!hasPermission('daycare', 'create')) {
      toast.error('You do not have permission to check in dogs');
      return;
    }

    // If there are blockers, prevent check-in
    if (validation.blockers.length > 0) {
      toast.error('Cannot check in: Blockers must be resolved first');
      return;
    }

    // If there are warnings and not acknowledged, show error
    if (validation.warnings.length > 0 && !warningsAcknowledged) {
      toast.error('Please acknowledge all warnings before checking in');
      return;
    }

    setIsProcessing(true);
    try {
      await checkIn(booking.id, {
        handover_notes: handoverNotes,
        warnings_acknowledged: warningsAcknowledged,
      });

      toast.success(`${booking.pet_name} checked in successfully`);
      onActionComplete();
    } catch (error: any) {
      console.error('Check-in error:', error);
      toast.error(error.message || 'Failed to check in. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!booking) return;

    // Check permissions
    if (!hasPermission('daycare', 'update')) {
      toast.error('You do not have permission to check out dogs');
      return;
    }

    setIsProcessing(true);
    try {
      await checkOut(booking.id, checkoutNotes);

      toast.success(`${booking.pet_name} checked out successfully`);
      onActionComplete();
    } catch (error: any) {
      console.error('Check-out error:', error);
      toast.error(error.message || 'Failed to check out. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !booking) return null;

  const canCheckIn = hasPermission('daycare', 'create');
  const canCheckOut = hasPermission('daycare', 'update');

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
              {booking.pet_photo_url ? (
                <img src={booking.pet_photo_url} alt={booking.pet_name} className="h-full w-full object-cover" />
              ) : (
                <Dog className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{booking.pet_name}</h2>
              <p className="text-sm text-slate-500">{booking.household_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Booking Details */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Booking Details</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-medium text-slate-900">{booking.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-900">{new Date(booking.booking_date).toLocaleDateString('en-GB')}</span>
              </div>
              {booking.planned_start_time && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Planned Time:</span>
                  <span className="font-medium text-slate-900">
                    {booking.planned_start_time} {booking.planned_end_time && `- ${booking.planned_end_time}`}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="font-medium text-slate-900">{booking.location_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <StatusBadge status={booking.check_in_status} />
              </div>
            </div>

            {/* Check-in/out times */}
            {(booking.actual_check_in_time || booking.actual_check_out_time) && (
              <div className="bg-blue-50 rounded-lg p-4 mt-3 space-y-2 text-sm">
                {booking.actual_check_in_time && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">Checked in at:</span>
                    <span className="font-medium text-blue-900">
                      {new Date(booking.actual_check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {booking.checked_in_by_name && ` by ${booking.checked_in_by_name}`}
                    </span>
                  </div>
                )}
                {booking.actual_check_out_time && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Checked out at:</span>
                    <span className="font-medium text-green-900">
                      {new Date(booking.actual_check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {booking.checked_out_by_name && ` by ${booking.checked_out_by_name}`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Blockers and Warnings */}
          {booking.check_in_status === 'not_checked_in' && validation && (
            <>
              {/* Blockers */}
              {validation.blockers.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <Prohibit className="h-4 w-4" />
                    Blockers (Must Resolve)
                  </h3>
                  <div className="space-y-2">
                    {validation.blockers.map((blocker, idx) => (
                      <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <Warning className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900">{blocker.message}</p>
                          {blocker.details && (
                            <p className="text-xs text-red-700 mt-1">{JSON.stringify(blocker.details)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                    <FileDashed className="h-4 w-4" />
                    Warnings (Acknowledge to Proceed)
                  </h3>
                  <div className="space-y-2">
                    {validation.warnings.map((warning, idx) => (
                      <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                        <Warning className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">{warning.message}</p>
                          {warning.details && (
                            <p className="text-xs text-amber-700 mt-1">{JSON.stringify(warning.details)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="mt-3 flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={warningsAcknowledged}
                      onChange={(e) => setWarningsAcknowledged(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                    />
                    <span className="text-sm text-slate-700">
                      I acknowledge all warnings and understand the risks
                    </span>
                  </label>
                </section>
              )}
            </>
          )}

          {/* Notes */}
          {booking.customer_notes && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Customer Notes</h3>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
                {booking.customer_notes}
              </div>
            </section>
          )}

          {booking.handover_notes && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Handover Notes (Check-in)</h3>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-slate-700">
                {booking.handover_notes}
              </div>
            </section>
          )}

          {booking.checkout_notes && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Check-out Notes</h3>
              <div className="bg-green-50 rounded-lg p-3 text-sm text-slate-700">
                {booking.checkout_notes}
              </div>
            </section>
          )}

          {/* Check-in Notes Input */}
          {booking.check_in_status === 'not_checked_in' && canCheckIn && (
            <section>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Handover Notes (Optional)
              </label>
              <textarea
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Any notes from the customer at drop-off..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                rows={3}
              />
            </section>
          )}

          {/* Check-out Notes Input */}
          {booking.check_in_status === 'checked_in' && canCheckOut && (
            <section>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Check-out Notes (Optional)
              </label>
              <textarea
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="How was the dog's day? Any incidents or highlights..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                rows={3}
              />
            </section>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-3">
            {/* Check In Button */}
            {booking.check_in_status === 'not_checked_in' && canCheckIn && (
              <button
                onClick={handleCheckIn}
                disabled={isProcessing || isValidating || (validation?.blockers.length || 0) > 0}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors",
                  isProcessing || isValidating || (validation?.blockers.length || 0) > 0
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                )}
              >
                <CheckCircle className="h-5 w-5" />
                {isProcessing ? 'Checking In...' : 'Check In'}
              </button>
            )}

            {/* Check Out Button */}
            {booking.check_in_status === 'checked_in' && canCheckOut && (
              <button
                onClick={handleCheckOut}
                disabled={isProcessing}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors",
                  isProcessing
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                <SignOut className="h-5 w-5" />
                {isProcessing ? 'Checking Out...' : 'Check Out'}
              </button>
            )}

            {/* Read-only state for checked out */}
            {booking.check_in_status === 'checked_out' && (
              <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-100 text-green-700 rounded-md font-medium">
                <CheckCircle className="h-5 w-5" />
                Completed
              </div>
            )}

            {/* Secondary Actions */}
            {hasPermission('messaging', 'create') && (
              <button
                onClick={() => toast.info('Messaging feature coming soon')}
                className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                title="Message Customer"
              >
                <ChatTeardrop className="h-5 w-5" />
              </button>
            )}

            {hasPermission('incidents', 'create') && (
              <button
                onClick={() => toast.info('Incident reporting coming soon')}
                className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                title="Create Incident"
              >
                <FileText className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Permission notice */}
          {booking.check_in_status === 'not_checked_in' && !canCheckIn && (
            <p className="text-xs text-slate-500 text-center mt-3">
              You do not have permission to check in dogs
            </p>
          )}
          {booking.check_in_status === 'checked_in' && !canCheckOut && (
            <p className="text-xs text-slate-500 text-center mt-3">
              You do not have permission to check out dogs
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// Status badge component
function StatusBadge({ status }: { status: 'not_checked_in' | 'checked_in' | 'checked_out' }) {
  const config = {
    not_checked_in: { label: 'Not Checked In', className: 'bg-slate-100 text-slate-700' },
    checked_in: { label: 'In Daycare', className: 'bg-blue-100 text-blue-700' },
    checked_out: { label: 'Checked Out', className: 'bg-green-100 text-green-700' },
  };

  const { label, className } = config[status];

  return (
    <span className={cn("px-2 py-1 text-xs font-medium rounded-md whitespace-nowrap", className)}>
      {label}
    </span>
  );
}
