import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { Dialog, DialogContent } from '../../../components/ui/dialog';
import { Textarea } from '../../../components/ui/textarea';
import {
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  X,
  Clock,
  SignOut,
  Dog,
  Warning,
  FirstAidKit,
  CheckCircle,
  Smiley,
  SmileyMeh,
  SmileySad,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useConnectivity } from '../../../hooks/useConnectivity';
import type { DaycareBooking } from '../types';

type Mood = 'great' | 'good' | 'tired';

const MOOD_OPTIONS: { value: Mood; label: string; Icon: React.ElementType; colour: string }[] = [
  { value: 'great', label: 'Great day', Icon: Smiley,    colour: '#16A34A' },
  { value: 'good',  label: 'Good day',  Icon: SmileyMeh, colour: '#D97706' },
  { value: 'tired', label: 'Tired',     Icon: SmileySad, colour: '#6B7280' },
];

function formatDuration(checkInIso: string): string {
  const checkIn = new Date(checkInIso);
  if (isNaN(checkIn.getTime())) return '—';
  const minutes = Math.floor((Date.now() - checkIn.getTime()) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function DaycareCheckOut() {
  const navigate = useNavigate();
  const { selectedLocationId } = useDashboardStore();
  const { bookings, isLoading, fetchBookings, checkOut } = useDaycareStore();
  const isOnline = useConnectivity();

  const [searchQuery, setSearchQuery]     = useState('');
  const [selected, setSelected]           = useState<DaycareBooking | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [mood, setMood]                   = useState<Mood | null>(null);
  const [showDialog, setShowDialog]       = useState(false);
  const [submitting, setSubmitting]       = useState(false);

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
    setCheckoutNotes('');
    setMood(null);
    setShowDialog(true);
  };

  const handleCheckOut = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const notes = [
        mood ? `Mood: ${MOOD_OPTIONS.find(m => m.value === mood)?.label}` : null,
        checkoutNotes.trim() || null,
      ].filter(Boolean).join('\n');

      await checkOut(selected.id, notes || undefined);
      toast.success(`${selected.pet_name} checked out`);
      setShowDialog(false);
      setSelected(null);

      const { fetchStats } = useDaycareStore.getState();
      await Promise.all([
        load(),
        fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today),
      ]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to check out');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>

      {/* Top bar */}
      <div className="bg-white border-b border-[#E2DED8] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/daycare')}
            className="p-1.5 rounded-lg hover:bg-[#F4F3EF] text-[#6B6762] transition-colors"
          >
            <CaretLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#1C1916]">Check Out</h1>
            <p className="text-xs text-[#6B6762]">
              {filtered.length} {filtered.length === 1 ? 'dog' : 'dogs'} on site
            </p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9E9B97]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by pet or owner name…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DED8] bg-[#F4F3EF] text-base md:text-sm text-[#1C1916] placeholder:text-[#9E9B97] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9E9B97] hover:text-[#1C1916] transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">

        {isLoading && [0, 1, 2].map(i => (
          <div key={i} className="animate-pulse rounded-2xl h-24 bg-white border border-[#E2DED8]" />
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Dog size={48} weight="thin" className="text-[#D4CFC9] mb-3" />
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

          return (
            <button
              key={booking.id}
              onClick={() => openDialog(booking)}
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
                    <Warning size={13} weight="fill" className="text-amber-500 flex-shrink-0" />
                  )}
                  {booking.has_medical_flag && (
                    <FirstAidKit size={13} weight="fill" className="text-red-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#6B6762] truncate">{booking.household_name}</p>
                {checkInTime && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={11} className="text-[#9E9B97]" />
                    <span className="text-xs text-[#9E9B97]">In at {checkInTime}</span>
                    {duration && (
                      <span className="text-xs font-semibold ml-1" style={{ color: 'var(--primary)' }}>
                        · {duration}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <CaretRight size={16} className="text-[#C8C4BC] flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Check-out dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden">

          {/* Header — mirrors check-in style */}
          <div className="px-6 pt-6 pb-5 flex items-center gap-4" style={{ background: 'var(--primary-tint)' }}>
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'var(--primary)' }}
            >
              {selected?.pet_photo_url ? (
                <img src={selected.pet_photo_url} alt={selected.pet_name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-white">
                  {selected?.pet_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#1C1916] leading-tight">{selected?.pet_name}</h2>
              <p className="text-sm text-[#6B6762] truncate">{selected?.household_name}</p>

              {/* Duration strip */}
              {selected?.actual_check_in_time && (
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-[#6B6762]" />
                    <span className="text-xs text-[#6B6762]">
                      In {formatTime(selected.actual_check_in_time)}
                    </span>
                  </div>
                  <span
                    className="text-sm font-bold"
                    style={{ color: 'var(--primary)' }}
                  >
                    {formatDuration(selected.actual_check_in_time)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Flags */}
            {(selected?.has_behaviour_flag || selected?.has_medical_flag) && (
              <div className="space-y-2">
                {selected?.has_behaviour_flag && selected?.behaviour_notes && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <Warning size={15} weight="fill" className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">{selected.behaviour_notes}</p>
                  </div>
                )}
                {selected?.has_medical_flag && selected?.medical_notes && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <FirstAidKit size={15} weight="fill" className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-800">{selected.medical_notes}</p>
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
                Notes for the owner <span className="text-[#9E9B97] font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Anything the owner should know…"
                value={checkoutNotes}
                onChange={e => setCheckoutNotes(e.target.value)}
                rows={3}
                className="resize-none text-base md:text-sm rounded-xl border-[#E2DED8] bg-[#F4F3EF] placeholder:text-[#9E9B97] focus:border-primary focus:ring-primary/10"
              />
            </div>
          </div>

          {/* Footer */}
          {!isOnline && (
            <p className="text-xs text-red-700 text-center px-6 pb-2 -mt-2">
              You're offline — this check-out can't be saved right now.
            </p>
          )}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => setShowDialog(false)}
              className="flex-1 h-11 rounded-xl border border-[#E2DED8] text-[#1C1916] text-sm font-medium hover:bg-[#F4F3EF] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckOut}
              disabled={submitting || !isOnline}
              className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity"
              style={{ background: 'var(--primary)' }}
            >
              <SignOut size={16} weight="bold" />
              {submitting ? 'Checking out…' : `Check Out ${selected?.pet_name}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
