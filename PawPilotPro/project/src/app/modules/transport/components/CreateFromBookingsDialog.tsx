/**
 * Create Transport Jobs from Daycare Bookings
 *
 * Fetches confirmed daycare bookings that require transport for the selected
 * date/location, lets the dispatcher select which ones to process, then
 * batch-creates transport jobs in one click.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '@/utils/supabase/authHeaders';
import { projectId } from '../../../../../utils/supabase/info';
import { useSettingsStore } from '../../settings/store';
import type { DaycareBooking } from '../../daycare/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Dog,
  MapPin,
  Clock,
  Truck,
  CircleNotch,
  CheckCircle,
  Warning,
} from '@phosphor-icons/react';

type Direction = 'pickup' | 'dropoff' | 'roundtrip';

interface CreateFromBookingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  locationId: string;
  onCreated?: () => void;
}

const DAYCARE_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare`;
const TRANSPORT_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/transport`;

export function CreateFromBookingsDialog({
  open,
  onOpenChange,
  date,
  locationId,
  onCreated,
}: CreateFromBookingsDialogProps) {
  const { locations } = useSettingsStore();

  const [bookings, setBookings] = useState<DaycareBooking[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Global job settings applied to all selected bookings
  const [direction, setDirection] = useState<Direction>('pickup');
  const [addressPickup, setAddressPickup] = useState('');
  const [addressDropoff, setAddressDropoff] = useState('');

  const dateStr = format(date, 'yyyy-MM-dd');
  const location = locations.find(l => l.id === locationId);
  const locationName = location?.name ?? 'Facility';
  // Prefer the facility's real street address so the driver's navigation
  // works; fall back to the name only if no address is on file.
  const locationAddress = location?.address || locationName;

  // Pre-fill dropoff with the facility address
  useEffect(() => {
    if (open) setAddressDropoff(locationAddress);
  }, [open, locationAddress]);

  const fetchBookings = useCallback(async () => {
    if (!locationId) return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        date: dateStr,
        location_id: locationId,
        booking_status: 'confirmed',
      });
      const res = await fetch(`${DAYCARE_BASE}/bookings?${params}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const all: DaycareBooking[] = data.bookings ?? data ?? [];
      // Only bookings that actually need transport
      const transport = all.filter(b => b.requires_transport);
      setBookings(transport);
      // Pre-select all
      setSelectedIds(new Set(transport.map(b => b.id)));
    } catch (err: any) {
      setFetchError(err.message);
      setBookings([]);
    } finally {
      setIsFetching(false);
    }
  }, [locationId, dateStr]);

  useEffect(() => {
    if (open) fetchBookings();
  }, [open, fetchBookings]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev =>
      prev.size === bookings.length ? new Set() : new Set(bookings.map(b => b.id))
    );
  };

  const canCreate =
    selectedIds.size > 0 &&
    (direction === 'pickup'
      ? !!addressPickup.trim()
      : direction === 'dropoff'
      ? !!addressDropoff.trim()
      : !!(addressPickup.trim() && addressDropoff.trim()));

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);

    const headers = await getAuthHeaders().catch(() => null);
    if (!headers) { toast.error('Not authenticated'); setIsCreating(false); return; }

    const selected = bookings.filter(b => selectedIds.has(b.id));

    // Create sequentially, NOT in parallel: each job append does a
    // read-modify-write on the shared per-date/per-location KV index arrays
    // server-side, so concurrent creates race and silently drop index
    // entries (jobs that exist but never show on the dashboard).
    let created = 0;
    let sessionExpired = false;
    const failures: string[] = [];

    for (const booking of selected) {
      const payload = {
        location_id: locationId,
        service_date: dateStr,
        direction,
        household_id: booking.household_id,
        pet_id: booking.pet_id,
        address_pickup: addressPickup.trim() || null,
        address_dropoff: addressDropoff.trim() || null,
        time_window_start: booking.planned_start_time ?? null,
        time_window_end: booking.planned_end_time ?? null,
        notes: booking.notes ?? null,
        booking_id: booking.id,
        booking_type: 'daycare',
      };

      try {
        const res = await fetch(`${TRANSPORT_BASE}/jobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          sessionExpired = true;
          break;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        created++;
      } catch (err: any) {
        failures.push(`${booking.pet_name}: ${err?.message ?? 'failed'}`);
      }
    }

    setIsCreating(false);

    if (sessionExpired) {
      toast.error('Your session expired. Please log in again.');
      return;
    }

    if (created > 0) {
      toast.success(`${created} transport job${created !== 1 ? 's' : ''} created`);
      onCreated?.();
      if (failures.length === 0) {
        onOpenChange(false);
      }
    }
    if (failures.length > 0) {
      toast.error(
        `${failures.length} job${failures.length !== 1 ? 's' : ''} failed:\n${failures.join('\n')}`
      );
    }
  };

  const handleClose = () => {
    setBookings([]);
    setSelectedIds(new Set());
    setDirection('pickup');
    setAddressPickup('');
    setFetchError(null);
    onOpenChange(false);
  };

  const directionLabel: Record<Direction, string> = {
    pickup: 'Pick-up (morning — collect from home)',
    dropoff: 'Drop-off (afternoon — return home)',
    roundtrip: 'Round trip (both pick-up and drop-off)',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Create Transport Jobs from Bookings
          </DialogTitle>
          <DialogDescription>
            Confirmed bookings requiring transport on{' '}
            <strong>{format(date, 'EEEE, d MMMM yyyy')}</strong> at <strong>{locationName}</strong>.
            Select bookings, set the direction and addresses, then create all jobs at once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-5 py-2">

          {/* Direction selector */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['pickup', 'dropoff', 'roundtrip'] as Direction[]).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`p-2 rounded-lg border-2 text-sm font-medium transition-all capitalize ${
                    direction === d
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {d === 'roundtrip' ? 'Round trip' : d === 'pickup' ? 'Pick-up' : 'Drop-off'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{directionLabel[direction]}</p>
          </div>

          {/* Address fields */}
          <div className="grid grid-cols-2 gap-4">
            {(direction === 'pickup' || direction === 'roundtrip') && (
              <div>
                <Label htmlFor="pickupAddr">Pick-up address</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="pickupAddr"
                    value={addressPickup}
                    onChange={e => setAddressPickup(e.target.value)}
                    placeholder="Household address…"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Applied to all selected bookings</p>
              </div>
            )}
            {(direction === 'dropoff' || direction === 'roundtrip') && (
              <div>
                <Label htmlFor="dropoffAddr">Drop-off address</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="dropoffAddr"
                    value={addressDropoff}
                    onChange={e => setAddressDropoff(e.target.value)}
                    placeholder="Daycare facility address…"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Pre-filled with facility name — update if needed</p>
              </div>
            )}
          </div>

          {/* Booking list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Bookings requiring transport ({bookings.length})</Label>
              {bookings.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selectedIds.size === bookings.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {isFetching && (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <CircleNotch className="h-5 w-5 animate-spin mr-2" />
                Loading bookings…
              </div>
            )}

            {fetchError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <Warning className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{fetchError}</p>
              </div>
            )}

            {!isFetching && !fetchError && bookings.length === 0 && (
              <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-lg">
                <Dog className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No transport-required bookings found</p>
                <p className="text-xs mt-1">
                  Only confirmed bookings with <em>Requires transport</em> ticked will appear here.
                </p>
              </div>
            )}

            {!isFetching && bookings.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-auto">
                {bookings.map(b => {
                  const checked = selectedIds.has(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        checked ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(b.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Dog className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-900 truncate">{b.pet_name}</span>
                          <span className="text-slate-400 text-xs truncate">{b.household_name}</span>
                        </div>
                        {(b.planned_start_time || b.planned_end_time) && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                            <Clock className="h-3 w-3" />
                            {b.planned_start_time ?? '--:--'} – {b.planned_end_time ?? '--:--'}
                          </div>
                        )}
                      </div>
                      {checked && <CheckCircle className="h-4 w-4 text-blue-500 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {selectedIds.size} booking{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canCreate || isCreating}>
              {isCreating ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Create {selectedIds.size} Job{selectedIds.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
