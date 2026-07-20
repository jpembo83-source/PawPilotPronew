// Standing schedule editor — a dog's weekly daycare pattern, entered once.
// Opened from the pet profile. Pick the weekdays, a session per day, billing
// and dates; the server generates the concrete bookings for the rolling
// horizon and staff only record exceptions from the week planner.

import React, { useEffect, useState } from 'react';
import { useStandingStore, type StandingBooking } from '../standingStore';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Calendar, MapPin, Medal, CreditCard, Repeat } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  ALL_SESSIONS,
  SESSION_DETAILS,
  type DaycareSession,
  type Weekday,
} from '../lib/multiDayBooking';

/** Weekday chip order shown in the editor (Mon-first). */
const WEEKDAY_CHIPS: { day: Weekday; chip: string; label: string }[] = [
  { day: 1, chip: 'M', label: 'Monday' },
  { day: 2, chip: 'T', label: 'Tuesday' },
  { day: 3, chip: 'W', label: 'Wednesday' },
  { day: 4, chip: 'T', label: 'Thursday' },
  { day: 5, chip: 'F', label: 'Friday' },
  { day: 6, chip: 'S', label: 'Saturday' },
  { day: 0, chip: 'S', label: 'Sunday' },
];

interface StandingScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pet: { id: string; name: string };
  householdId: string;
  onSaved?: () => void;
}

export function StandingScheduleDialog({
  open,
  onOpenChange,
  pet,
  householdId,
  onSaved,
}: StandingScheduleDialogProps) {
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { fetchSchedules, createSchedule, updateSchedule, isLoading } = useStandingStore();

  // The schedule being edited (a pet has at most one active per location).
  const [existing, setExisting] = useState<StandingBooking | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [days, setDays] = useState<Partial<Record<Weekday, DaycareSession>>>({});
  const [billingType, setBillingType] = useState<'membership' | 'payg'>('payg');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [localLocationId, setLocalLocationId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDays({});
    setBillingType('payg');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setActive(true);
    setLocalLocationId(selectedLocationId === 'ALL' ? '' : selectedLocationId);
    setExisting(null);

    setLoadingExisting(true);
    fetchSchedules({ pet_id: pet.id })
      .then((schedules) => {
        const current = schedules.find((s) => s.active) ?? schedules[schedules.length - 1] ?? null;
        if (current) {
          setExisting(current);
          setDays(current.days);
          setBillingType(current.billing_type);
          setStartDate(current.start_date);
          setEndDate(current.end_date ?? '');
          setLocalLocationId(current.location_id);
          setActive(current.active);
        }
      })
      .catch(() => {
        /* fetch error already lands in store.error; the editor still opens blank */
      })
      .finally(() => setLoadingExisting(false));
  }, [open, pet.id]);

  const toggleDay = (day: Weekday) => {
    setDays((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = 'full_day';
      return next;
    });
  };

  const setSession = (day: Weekday, session: DaycareSession) => {
    setDays((prev) => ({ ...prev, [day]: session }));
  };

  const selectedDays = WEEKDAY_CHIPS.filter(({ day }) => days[day]);

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      toast.error('Pick at least one weekday');
      return;
    }
    if (!localLocationId) {
      toast.error('Pick a location');
      return;
    }
    if (!startDate) {
      toast.error('Pick a start date');
      return;
    }
    if (endDate && endDate < startDate) {
      toast.error('End date must be on or after the start date');
      return;
    }

    setSaving(true);
    try {
      const input = {
        household_id: householdId,
        pet_id: pet.id,
        location_id: localLocationId,
        location_name: locations.find((l) => l.id === localLocationId)?.name || '',
        days,
        billing_type: billingType,
        start_date: startDate,
        end_date: endDate || null,
        active,
      };
      const result = existing
        ? await updateSchedule(existing.id, input)
        : await createSchedule(input);

      const gen = result.generation;
      if (gen.warnings.length > 0) {
        toast.warning(
          `Schedule saved. ${gen.created} day${gen.created === 1 ? '' : 's'} booked; ${gen.warnings.length} could not be booked (first: ${gen.warnings[0].date} — ${gen.warnings[0].reason === 'capacity_full' ? 'capacity full' : gen.warnings[0].reason}).`,
        );
      } else {
        toast.success(
          existing
            ? `Standing schedule updated for ${pet.name}${gen.created ? ` — ${gen.created} new day${gen.created === 1 ? '' : 's'} booked` : ''}`
            : `Standing schedule saved — ${gen.created} day${gen.created === 1 ? '' : 's'} booked for ${pet.name}`,
        );
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat size={18} aria-hidden="true" />
            Standing schedule
          </DialogTitle>
          <DialogDescription>
            {existing
              ? `Edit ${pet.name}'s weekly pattern — changes apply to days not yet booked.`
              : `Set ${pet.name}'s weekly pattern once; upcoming weeks are booked automatically.`}
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-4">
            {/* Weekday chips */}
            <div>
              <Label className="mb-1.5 block">Days of the week</Label>
              <div className="flex gap-1.5">
                {WEEKDAY_CHIPS.map(({ day, chip, label }) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={!!days[day]}
                    aria-label={label}
                    className={`h-11 w-11 rounded-full border text-sm font-medium transition-colors ${
                      days[day]
                        ? 'border-primary bg-primary-tint text-primary'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Session per selected day */}
            {selectedDays.length > 0 && (
              <div>
                <Label className="mb-1.5 block">Session per day</Label>
                <div className="space-y-1.5">
                  {selectedDays.map(({ day, label }) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-24 text-sm font-medium text-slate-700 shrink-0">{label}</span>
                      <div className="flex gap-1.5 flex-1">
                        {ALL_SESSIONS.map((session) => (
                          <button
                            key={session}
                            type="button"
                            onClick={() => setSession(day, session)}
                            aria-pressed={days[day] === session}
                            className={`flex-1 h-11 px-2 rounded-lg border text-sm font-medium transition-colors ${
                              days[day] === session
                                ? 'border-primary bg-primary-tint text-primary'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {SESSION_DETAILS[session].shortLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Billing */}
            <div>
              <Label className="mb-1.5 block">Billing</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingType('membership')}
                  aria-pressed={billingType === 'membership'}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    billingType === 'membership'
                      ? 'border-primary bg-primary-tint'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Medal size={14} aria-hidden="true" /> Membership
                  </span>
                  <span className="block text-sm text-muted-foreground mt-0.5">
                    Covered days draw from the plan; others bill PAYG
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingType('payg')}
                  aria-pressed={billingType === 'payg'}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    billingType === 'payg'
                      ? 'border-primary bg-primary-tint'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <CreditCard size={14} aria-hidden="true" /> Pay as you go
                  </span>
                  <span className="block text-sm text-muted-foreground mt-0.5">Standard rate each day</span>
                </button>
              </div>
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="standing-location" className="flex items-center gap-1.5 mb-1.5">
                <MapPin size={14} aria-hidden="true" /> Location
              </Label>
              <select
                id="standing-location"
                value={localLocationId}
                onChange={(e) => setLocalLocationId(e.target.value)}
                className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Select a location…</option>
                {locations
                  .filter((l) => l?.isActive)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="standing-start" className="flex items-center gap-1.5 mb-1.5">
                  <Calendar size={14} aria-hidden="true" /> Starts
                </Label>
                <Input
                  id="standing-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="standing-end" className="flex items-center gap-1.5 mb-1.5">
                  <Calendar size={14} aria-hidden="true" /> Ends{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="standing-end"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Pause/resume — edit mode only */}
            {existing && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Schedule is active (untick to pause — already-booked days are kept)
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || isLoading || loadingExisting || selectedDays.length === 0 || !localLocationId}
            style={{ backgroundColor: 'var(--primary)' }}
            className="text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : existing ? 'Update schedule' : 'Save schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
