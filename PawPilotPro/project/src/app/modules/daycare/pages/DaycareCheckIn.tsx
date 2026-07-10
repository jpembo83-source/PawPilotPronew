import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { Checkbox } from '../../../components/ui/checkbox';
import { CheckInDialog } from '../components/CheckInDialog';
import {
  MagnifyingGlass,
  X,
  Clock,
  SignIn,
  CaretLeft,
  CaretRight,
  Dog,
  Warning,
  FirstAidKit,
  XCircle,
  CheckCircle,
  UserPlus,
  Checks,
  Check,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useConnectivity } from '../../../hooks/useConnectivity';
import {
  sectionOf,
  blockedReasons,
  includedEntries,
  canConfirmBatch,
  type BatchEntry,
} from '../lib/bulkCheckIn';
import type { DaycareBooking, CheckInValidation } from '../types';

import { useBackNavigation } from '../../../components/BackButton';
// ── Helpers ────────────────────────────────────────────────────────────────────

function isLate(booking: DaycareBooking): boolean {
  if (!booking.planned_start_time) return false;
  const [h, m] = booking.planned_start_time.split(':').map(Number);
  const planned = new Date();
  planned.setHours(h, m, 0, 0);
  return Date.now() - planned.getTime() > 30 * 60 * 1000; // >30 min past planned time
}

// ── Walk-in search panel ───────────────────────────────────────────────────────

interface WalkInPanelProps {
  open: boolean;
  onClose: () => void;
  onBooked: (booking: DaycareBooking) => void;
  locationId: string;
}

function WalkInPanel({ open, onClose, onBooked, locationId }: WalkInPanelProps) {
  const { searchCustomers, createBooking, validateCheckIn, checkIn, isLoading } = useDaycareStore();
  const { locations } = useSettingsStore();
  const isOnline = useConnectivity();

  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<any[]>([]);
  const [searching, setSearching]       = useState(false);
  const [selectedHousehold, setHH]      = useState<any | null>(null);
  const [selectedPet, setPet]           = useState<any | null>(null);
  const [creating, setCreating]         = useState(false);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when panel closes
  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setHH(null); setPet(null); }
  }, [open]);

  // Live search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchCustomers(query.trim());
        setResults(res);
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 300);
  }, [query]);

  const handleSelectPet = (household: any, pet: any) => {
    setHH(household);
    setPet(pet);
  };

  const handleCreate = async () => {
    if (!selectedHousehold || !selectedPet || locationId === 'ALL') return;
    setCreating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const locationName = locations.find(l => l.id === locationId)?.name || '';
      const now = new Date();
      const startTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      // Create booking
      const booking = await createBooking({
        household_id:     selectedHousehold.household_id,
        pet_id:           selectedPet.id,
        location_id:      locationId,
        location_name:    locationName,
        service_id:       'service-daycare-full',
        service_name:     'Daycare (Full Day)',
        service_type:     'full_day',
        booking_date:     today,
        planned_start_time: startTime,
        planned_end_time:   '18:00',
      });

      // Immediately check in
      const validation = await validateCheckIn(booking.id);
      if (validation.can_check_in && validation.blockers.length === 0) {
        await checkIn(booking.id, { warnings_acknowledged: validation.warnings.length > 0 });
        toast.success(`${selectedPet.name} booked and checked in`);
        onBooked(booking);
      } else if (validation.blockers.length > 0) {
        toast.warning(`Booking created — check-in blocked: ${validation.blockers[0].message}`);
        onClose();
      } else {
        onBooked(booking);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create walk-in');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white rounded-2xl border border-[#E2DED8] shadow-xl m-4 overflow-hidden">
      {/* Walk-in header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#E2DED8]">
        <button
          onClick={onClose}
          aria-label="Close walk-in"
          className="p-1.5 rounded-lg hover:bg-[#F4F3EF] text-[#6B6762] transition-colors"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div>
          <h2 className="text-base font-bold text-[#1C1916]">Walk-in</h2>
          <p className="text-xs text-[#6B6762]">Search for a household to book and check in now</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary-foreground" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search by pet or household name"
            placeholder="Search by pet or household name…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DED8] bg-[#F4F3EF] text-base md:text-sm text-[#1C1916] placeholder:text-tertiary-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
          {searching && (
            <div role="status" aria-label="Searching" className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto px-4 pb-4 space-y-2 mt-2">
        {results.length === 0 && query.length >= 2 && !searching && (
          <p className="text-sm text-center text-tertiary-foreground py-8">No households found</p>
        )}

        {results.map((household, i) => (
          <div key={i} className="rounded-xl border border-[#E2DED8] overflow-hidden">
            <div className="px-4 py-3 bg-[#FAFAF8]">
              <p className="text-sm font-semibold text-[#1C1916]">{household.household_name}</p>
            </div>
            {household.pets.map((pet: any) => {
              const petInfo = pet as { name: string; behaviour_notes?: string; medical_notes?: string };
              const householdName = (household as { household_name: string }).household_name;
              const isSelected = selectedPet?.id === pet.id;
              const petFlags = [
                petInfo.behaviour_notes ? 'has behaviour alert' : null,
                petInfo.medical_notes ? 'has medical alert' : null,
              ].filter(Boolean).join(', ');
              return (
                <button
                  key={pet.id}
                  onClick={() => handleSelectPet(isSelected ? null : household, isSelected ? null : pet)}
                  aria-pressed={isSelected}
                  aria-label={`${petInfo.name}, ${householdName}${petFlags ? `, ${petFlags}` : ''}`}
                  className="w-full flex items-center gap-3 px-4 py-3 border-t border-[#F0EDE8] transition-colors"
                  style={{ background: isSelected ? 'var(--primary-tint)' : 'white' }}
                >
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: isSelected ? 'var(--primary)' : '#F0EDE8', color: isSelected ? 'white' : '#6B6762' }}
                  >
                    {pet.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-[#1C1916]">{pet.name}</p>
                    {pet.breed && <p className="text-xs text-tertiary-foreground truncate">{pet.breed}</p>}
                  </div>
                  {pet.behaviour_notes && <Warning size={14} weight="fill" aria-hidden="true" className="text-amber-500 flex-shrink-0" />}
                  {pet.medical_notes   && <FirstAidKit size={14} weight="fill" aria-hidden="true" className="text-red-500 flex-shrink-0" />}
                  {isSelected && <CheckCircle size={18} weight="fill" aria-hidden="true" style={{ color: 'var(--primary)' }} className="flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Confirm */}
      {selectedPet && (
        <div className="px-4 pb-4 pt-2 border-t border-[#E2DED8]">
          {locationId === 'ALL' ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-3 text-center">
              Select a specific location before creating a walk-in
            </p>
          ) : (
            <>
              <button
                onClick={handleCreate}
                disabled={creating || isLoading || !isOnline}
                className="w-full h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
                style={{ background: 'var(--primary)' }}
              >
                <SignIn size={17} weight="bold" />
                {creating ? 'Booking & checking in…' : `Check in ${selectedPet.name} as walk-in`}
              </button>
              {!isOnline && (
                <p className="text-xs text-red-700 text-center mt-2">
                  You're offline — this walk-in can't be saved right now.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main check-in page ─────────────────────────────────────────────────────────

export function DaycareCheckIn() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/daycare');
  const { selectedLocationId } = useDashboardStore();
  const { bookings, isLoading, fetchBookings, validateCheckIn, checkIn } = useDaycareStore();
  const isOnline = useConnectivity();

  const [searchQuery, setSearchQuery]             = useState('');
  const [selectedBooking, setSelectedBooking]     = useState<DaycareBooking | null>(null);
  const [validation, setValidation]               = useState<CheckInValidation | null>(null);
  const [showValidationDialog, setShowDialog]     = useState(false);
  const [showWalkIn, setShowWalkIn]               = useState(false);

  // Bulk select mode. The single-dog tap flow is untouched when this is off.
  const [selectMode, setSelectMode]               = useState(false);
  const [selectedIds, setSelectedIds]             = useState<Set<string>>(new Set());
  const [batch, setBatch]                         = useState<BatchEntry[] | null>(null);
  const [batchAcks, setBatchAcks]                 = useState<Record<string, boolean>>({});
  const [batchValidating, setBatchValidating]     = useState(false);
  const [batchSubmitting, setBatchSubmitting]     = useState(false);

  const today         = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => { load(); }, [selectedLocationId]);

  const load = async () => {
    try {
      await fetchBookings({
        location_id:    selectedLocationId === 'ALL' ? undefined : selectedLocationId,
        date:           today,
        check_in_status: 'not_checked_in',
        booking_status:  'confirmed',
      });
    } catch { /* handled by store */ }
  };

  const filtered = bookings.filter(b =>
    searchQuery === '' ||
    b.pet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.household_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lateCount = filtered.filter(isLate).length;

  const handleSelectBooking = async (booking: DaycareBooking) => {
    try {
      const result = await validateCheckIn(booking.id);
      setValidation(result);
      setSelectedBooking(booking);
      setShowDialog(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to validate check-in');
    }
  };

  const handleCheckedIn = async () => {
    setSelectedBooking(null);
    setValidation(null);
    const { fetchStats } = useDaycareStore.getState();
    await Promise.all([
      load(),
      fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today),
    ]);
  };

  // ── Bulk select mode ─────────────────────────────────────────────────────

  const toggleSelectMode = () => {
    setSelectMode(on => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Validate every selected booking, then open ONE summary dialog. Each dog
  // is gated individually — same blocker/warning semantics as the single flow.
  const startBatch = async () => {
    const targets = bookings.filter(b => selectedIds.has(b.id));
    if (targets.length === 0 || batchValidating) return;
    setBatchValidating(true);
    try {
      const entries = await Promise.all(
        targets.map(async (booking): Promise<BatchEntry> => {
          try {
            return { booking, validation: await validateCheckIn(booking.id) };
          } catch (err) {
            // A failed validate call is treated as blocked and reported —
            // never silently skipped, never checked in unvalidated.
            const message = err instanceof Error && err.message ? err.message : 'Could not validate — try again';
            return { booking, validation: null, error: message };
          }
        })
      );
      setBatchAcks({});
      setBatch(entries);
    } finally {
      setBatchValidating(false);
    }
  };

  const handleBatchCheckIn = async () => {
    if (!batch || batchSubmitting || !canConfirmBatch(batch, batchAcks)) return;
    setBatchSubmitting(true);
    const included = includedEntries(batch, batchAcks);
    const succeeded: DaycareBooking[] = [];
    const failed: DaycareBooking[] = [];
    for (const entry of included) {
      try {
        await checkIn(entry.booking.id, {
          warnings_acknowledged: sectionOf(entry) === 'warning',
        });
        succeeded.push(entry.booking);
      } catch {
        failed.push(entry.booking);
      }
    }

    // One refresh for the whole batch, exactly like the single flow's refresh.
    const { fetchStats } = useDaycareStore.getState();
    await Promise.all([
      load(),
      fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today),
    ]);

    setBatch(null);
    setBatchSubmitting(false);

    if (succeeded.length > 0) {
      toast.success(`${succeeded.length} checked in`);
    }
    if (failed.length > 0) {
      toast.error(
        `Couldn't check in ${failed.map(b => b.pet_name).join(', ')} — still selected so you can retry.`
      );
      setSelectedIds(new Set(failed.map(b => b.id)));
    } else {
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  };

  const batchIncludedCount = batch ? includedEntries(batch, batchAcks).length : 0;
  const batchClear    = batch?.filter(e => sectionOf(e) === 'clear') ?? [];
  const batchWarned   = batch?.filter(e => sectionOf(e) === 'warning') ?? [];
  const batchBlocked  = batch?.filter(e => sectionOf(e) === 'blocked') ?? [];

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--background)' }}>

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
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#1C1916]">Check In</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-[#6B6762]">
                {filtered.length} waiting · {todayFormatted}
              </p>
              {lateCount > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {lateCount} late
                </span>
              )}
            </div>
          </div>

          {/* Select-mode toggle */}
          <button
            onClick={toggleSelectMode}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            style={selectMode
              ? { background: 'var(--primary)', color: '#fff' }
              : { background: '#F4F3EF', color: '#6B6762' }}
          >
            <Checks size={14} weight="bold" />
            {selectMode ? 'Done' : 'Select'}
          </button>

          {/* Walk-in button */}
          <button
            onClick={() => setShowWalkIn(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}
          >
            <UserPlus size={14} weight="bold" />
            Walk-in
          </button>
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

      {/* Booking list */}
      <div className="flex-1 overflow-auto p-4 space-y-3">

        {isLoading && (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading dogs waiting to check in…</span>
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-pulse rounded-2xl h-20 bg-white border border-[#E2DED8]" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Dog size={48} weight="thin" aria-hidden="true" className="text-[#D4CFC9] mb-3" />
            <p className="text-base font-medium text-[#1C1916] mb-1">No dogs waiting to check in</p>
            <p className="text-sm text-[#6B6762] mb-6">
              All confirmed bookings have been checked in.
            </p>
            <button
              onClick={() => setShowWalkIn(true)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}
            >
              <UserPlus size={15} weight="bold" />
              Add a walk-in
            </button>
          </div>
        )}

        {!isLoading && filtered.map(booking => {
          const late = isLate(booking);
          const isSelected = selectMode && selectedIds.has(booking.id);
          // Flag state is safety information — it belongs in the accessible
          // name, not just in the icon colour.
          const flagText = [
            booking.has_behaviour_flag ? 'has behaviour alert' : null,
            booking.has_medical_flag ? 'has medical alert' : null,
          ].filter(Boolean).join(', ');
          const cardLabel =
            `${selectMode ? (isSelected ? 'Deselect' : 'Select') : 'Check in'} ${booking.pet_name}, ` +
            `${booking.household_name}` +
            (flagText ? `, ${flagText}` : '') +
            (booking.planned_start_time ? `, booked for ${booking.planned_start_time}` : '') +
            (late ? ', running late' : '');
          return (
            <button
              key={booking.id}
              onClick={() => { if (selectMode) toggleSelected(booking.id); else void handleSelectBooking(booking); }}
              aria-pressed={selectMode ? isSelected : undefined}
              aria-label={cardLabel}
              className="w-full bg-white rounded-2xl border p-4 flex items-center gap-4 text-left hover:shadow-sm active:scale-[0.99] transition-all"
              style={{
                borderColor: isSelected ? 'var(--primary)' : late ? '#FCD34D' : '#E2DED8',
                background: isSelected ? 'var(--primary-tint)' : undefined,
              }}
            >
              {/* Selection affordance (select mode only) */}
              {selectMode && (
                <span
                  aria-hidden="true"
                  className="h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                  style={isSelected
                    ? { background: 'var(--primary)', borderColor: 'var(--primary)' }
                    : { borderColor: '#C8C4BC', background: '#fff' }}
                >
                  {isSelected && <Check size={14} weight="bold" className="text-white" />}
                </span>
              )}
              {/* Avatar */}
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--primary-tint)' }}
              >
                <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  {booking.pet_name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-semibold text-[#1C1916] text-sm">{booking.pet_name}</span>
                  {booking.service_type === 'membership' && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}>
                      Member
                    </span>
                  )}
                  {booking.has_behaviour_flag && (
                    <Warning size={13} weight="fill" aria-hidden="true" className="text-amber-500 flex-shrink-0" />
                  )}
                  {booking.has_medical_flag && (
                    <FirstAidKit size={13} weight="fill" aria-hidden="true" className="text-red-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#6B6762] truncate">{booking.household_name}</p>
                {booking.planned_start_time && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={11} className="text-tertiary-foreground" />
                    <span className="text-xs text-tertiary-foreground">{booking.planned_start_time}</span>
                    {late && (
                      // amber-700 — amber-600 is 3.4:1 on white, below AA
                      <span className="text-xs font-semibold text-amber-700 ml-1">· Late</span>
                    )}
                  </div>
                )}
              </div>

              <CaretRight size={16} className="text-[#C8C4BC] flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Bulk action bar — last flex child, so it sits above MobileLayout's
          bottom tab bar (which lives outside this page's scroll area and
          already carries the safe-area inset). */}
      {selectMode && (
        <div className="bg-white border-t border-[#E2DED8] px-4 py-3 flex items-center gap-3">
          <p role="status" aria-live="polite" className="text-sm text-[#6B6762] flex-1">
            {selectedIds.size === 0
              ? 'Tap dogs to select'
              : `${selectedIds.size} selected`}
          </p>
          <button
            onClick={() => void startBatch()}
            disabled={selectedIds.size === 0 || batchValidating || !isOnline}
            className="h-11 px-5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity"
            style={{ background: 'var(--primary)' }}
          >
            <SignIn size={16} weight="bold" />
            {batchValidating
              ? 'Checking…'
              : `Check in ${selectedIds.size} ${selectedIds.size === 1 ? 'dog' : 'dogs'}`}
          </button>
        </div>
      )}

      {/* Walk-in panel (overlay) */}
      <WalkInPanel
        open={showWalkIn}
        onClose={() => setShowWalkIn(false)}
        locationId={selectedLocationId}
        onBooked={async () => {
          setShowWalkIn(false);
          const { fetchStats } = useDaycareStore.getState();
          await Promise.all([
            load(),
            fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today),
          ]);
        }}
      />

      {/* Validation dialog */}
      <CheckInDialog
        open={showValidationDialog}
        onOpenChange={setShowDialog}
        booking={selectedBooking}
        validation={validation}
        onCheckedIn={handleCheckedIn}
      />

      {/* Bulk check-in summary dialog */}
      <Dialog open={batch !== null} onOpenChange={open => { if (!open && !batchSubmitting) setBatch(null); }}>
        <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4" style={{ background: 'var(--primary-tint)' }}>
            <DialogTitle className="text-xl font-bold text-[#1C1916] leading-tight">Check in dogs</DialogTitle>
            <DialogDescription className="text-sm text-[#6B6762] mt-0.5">
              Each dog is validated individually — blocked dogs are excluded.
            </DialogDescription>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[50vh] overflow-y-auto">

            {/* Clear */}
            {batchClear.length > 0 && (
              <div
                className="border rounded-xl p-4"
                style={{ background: 'var(--primary-tint)', borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} weight="fill" style={{ color: 'var(--primary)' }} className="flex-shrink-0" />
                  <span className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                    Ready to check in
                  </span>
                </div>
                <p className="text-sm text-[#1C1916] pl-6">
                  {batchClear.map(e => e.booking.pet_name).join(', ')}
                </p>
              </div>
            )}

            {/* Warnings — per-dog acknowledgment, same semantics as single flow */}
            {batchWarned.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Warning size={16} weight="fill" className="text-amber-600 flex-shrink-0" />
                  <span className="text-sm font-semibold text-amber-800">Warnings — acknowledge each dog</span>
                </div>
                {batchWarned.map(entry => (
                  <div key={entry.booking.id} className="pl-6">
                    <p className="text-sm font-semibold text-amber-900">{entry.booking.pet_name}</p>
                    <ul className="space-y-0.5 mb-2">
                      {entry.validation!.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-amber-700">{w.message}</li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`ack-${entry.booking.id}`}
                        checked={!!batchAcks[entry.booking.id]}
                        onCheckedChange={v =>
                          setBatchAcks(prev => ({ ...prev, [entry.booking.id]: v === true }))
                        }
                      />
                      <label
                        htmlFor={`ack-${entry.booking.id}`}
                        className="text-sm font-medium text-amber-900 cursor-pointer"
                      >
                        I acknowledge {entry.booking.pet_name}'s warnings
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Blocked — excluded from the batch, never silently skipped */}
            {batchBlocked.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle size={16} weight="fill" className="text-red-600 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-800">Blocked — will not be checked in</span>
                </div>
                {batchBlocked.map(entry => (
                  <div key={entry.booking.id} className="pl-6">
                    <p className="text-sm font-semibold text-red-900">{entry.booking.pet_name}</p>
                    <ul className="space-y-0.5">
                      {blockedReasons(entry).map((reason, i) => (
                        <li key={i} className="text-sm text-red-700">{reason}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => setBatch(null)}
              disabled={batchSubmitting}
              className="flex-1 h-11 rounded-xl border border-[#E2DED8] text-[#1C1916] text-sm font-medium hover:bg-[#F4F3EF] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleBatchCheckIn()}
              disabled={batchSubmitting || !batch || !canConfirmBatch(batch, batchAcks) || !isOnline}
              className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity"
              style={{ background: 'var(--primary)' }}
            >
              <SignIn size={16} weight="bold" />
              {batchSubmitting
                ? 'Checking in…'
                : `Check in ${batchIncludedCount} ${batchIncludedCount === 1 ? 'dog' : 'dogs'}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
