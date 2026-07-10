import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import {
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  X,
  Clock,
  Dog,
  Warning,
  FirstAidKit,
} from '@phosphor-icons/react';
import { CheckOutDialog, formatDuration, formatTime } from '../components/CheckOutDialog';
import type { DaycareBooking } from '../types';

import { useBackNavigation } from '../../../components/BackButton';
export function DaycareCheckOut() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/daycare');
  const { selectedLocationId } = useDashboardStore();
  const { bookings, isLoading, fetchBookings } = useDaycareStore();

  const [searchQuery, setSearchQuery]     = useState('');
  const [selected, setSelected]           = useState<DaycareBooking | null>(null);
  const [showDialog, setShowDialog]       = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, [selectedLocationId]);

  const load = async () => {
    try {
      await fetchBookings({
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
        date: today,
        check_in_status: 'checked_in',
      });
    } catch { /* handled by store */ }
  };

  const filtered = bookings.filter(b =>
    searchQuery === '' ||
    b.pet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.household_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openDialog = (booking: DaycareBooking) => {
    setSelected(booking);
    setShowDialog(true);
  };

  const handleCheckedOut = async () => {
    setSelected(null);
    const { fetchStats } = useDaycareStore.getState();
    await Promise.all([
      load(),
      fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today),
    ]);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>

      {/* Top bar */}
      <div className="bg-white border-b border-[#E2DED8] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={goBack}
            aria-label="Back to daycare"
            className="p-1.5 rounded-lg hover:bg-[#F4F3EF] text-[#6B6762] transition-colors"
          >
            <CaretLeft size={20} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#1C1916]">Check Out</h1>
            <p className="text-xs text-[#6B6762]">
              {filtered.length} {filtered.length === 1 ? 'dog' : 'dogs'} on site
            </p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search by pet or owner name"
            placeholder="Search by pet or owner name…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DED8] bg-[#F4F3EF] text-base md:text-sm text-[#1C1916] placeholder:text-tertiary-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tertiary-foreground hover:text-[#1C1916] transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">

        {isLoading && (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading dogs on site…</span>
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-pulse rounded-2xl h-24 bg-white border border-[#E2DED8]" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Dog size={48} weight="thin" aria-hidden="true" className="text-[#D4CFC9] mb-3" />
            <p className="text-base font-medium text-[#1C1916] mb-1">No dogs on site</p>
            <p className="text-sm text-[#6B6762]">All checked-in dogs have been checked out.</p>
          </div>
        )}

        {!isLoading && filtered.map(booking => {
          const duration = booking.actual_check_in_time
            ? formatDuration(booking.actual_check_in_time)
            : null;
          const checkInTime = booking.actual_check_in_time
            ? formatTime(booking.actual_check_in_time)
            : null;

          const flagText = [
            booking.has_behaviour_flag ? 'has behaviour alert' : null,
            booking.has_medical_flag ? 'has medical alert' : null,
          ].filter(Boolean).join(', ');
          const cardLabel =
            `Check out ${booking.pet_name}, ${booking.household_name}` +
            (flagText ? `, ${flagText}` : '') +
            (checkInTime ? `, in since ${checkInTime}` : '') +
            (duration ? `, on site ${duration}` : '');

          return (
            <button
              key={booking.id}
              onClick={() => openDialog(booking)}
              aria-label={cardLabel}
              className="w-full bg-white rounded-2xl border border-[#E2DED8] p-4 flex items-center gap-4 text-left hover:border-primary hover:shadow-sm active:scale-[0.99] transition-all"
            >
              {/* Avatar */}
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--primary-tint)' }}
              >
                {booking.pet_photo_url ? (
                  <img src={booking.pet_photo_url} alt={booking.pet_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                    {booking.pet_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-[#1C1916] text-sm">{booking.pet_name}</span>
                  {booking.has_behaviour_flag && (
                    <Warning size={13} weight="fill" aria-hidden="true" className="text-amber-500 flex-shrink-0" />
                  )}
                  {booking.has_medical_flag && (
                    <FirstAidKit size={13} weight="fill" aria-hidden="true" className="text-red-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#6B6762] truncate">{booking.household_name}</p>
                {checkInTime && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={11} className="text-tertiary-foreground" />
                    <span className="text-xs text-tertiary-foreground">In at {checkInTime}</span>
                    {duration && (
                      <span className="text-xs font-semibold ml-1" style={{ color: 'var(--primary)' }}>
                        · {duration}
                      </span>
                    )}
                  </div>
                )}
                {/* Drop-off handover — the handler doing pickup needs the
                    morning's instructions in front of them, not in the
                    timeline. */}
                {booking.handover_notes && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-1.5">
                    <span className="font-semibold">Handover:</span> {booking.handover_notes}
                  </p>
                )}
              </div>

              <CaretRight size={16} className="text-[#C8C4BC] flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Check-out dialog */}
      <CheckOutDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        booking={selected}
        onCheckedOut={handleCheckedOut}
      />
    </div>
  );
}
