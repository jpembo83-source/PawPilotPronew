// The "click out into a list" panel — one day of the paper register,
// digitised: every dog booked that day with the register's shorthand
// (Full / ½ AM / Trial, + PU/DO, flags), cancellations struck through,
// and "+ Add booking" so an operator can take a phone booking without
// leaving the capacity screen. Bottom sheet on phones, side panel on
// desktop.

import { useIsMobile } from '../../../components/ui/use-mobile';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../../components/ui/sheet';
import { usePermissions } from '../../../hooks/usePermissions';
import { Plus, Van, Warning, FirstAidKit, CheckCircle, Moon } from '@phosphor-icons/react';
import type { PlannerBooking } from '../types';
import { bookingsForDate, isCancelled, serviceShorthand, overnightOnlyForDate, type PlannerOvernightStay } from './plannerFormat';

interface DayBookingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  bookings: PlannerBooking[];
  overnightStays?: PlannerOvernightStay[];
  maxDogs: number;
  onAddBooking: (date: string) => void;
}

export function DayBookingsSheet({ open, onOpenChange, date, bookings, overnightStays = [], maxDogs, onAddBooking }: DayBookingsSheetProps) {
  const isMobile = useIsMobile();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('daycare', 'create');

  const dayBookings = bookingsForDate(bookings, date);
  const active = dayBookings.filter((b) => !isCancelled(b));
  // Boarders present that day whose dog isn't already a daycare booking.
  const dayBoarders = overnightOnlyForDate(bookings, overnightStays, date);
  const onSite = active.length + dayBoarders.length;
  const free = Math.max(0, maxDogs - onSite);

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={isMobile ? 'max-h-[85dvh] rounded-t-3xl p-0 flex flex-col' : 'w-full sm:max-w-md p-0 flex flex-col'}
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-[#E2DED8] text-left shrink-0">
          <SheetTitle className="text-lg font-bold text-[#1C1916]">{dateLabel}</SheetTitle>
          <SheetDescription className="text-sm text-[#6B6762]">
            {onSite}/{maxDogs} on-site · {free} free
            {dayBoarders.length > 0 && ` · ${dayBoarders.length} boarding`}
            {dayBookings.length > active.length && ` · ${dayBookings.length - active.length} cancelled`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5" role="list" aria-label={`Dogs on-site on ${dateLabel}`}>
          {dayBookings.length === 0 && dayBoarders.length === 0 && (
            <p className="text-sm text-tertiary-foreground text-center py-10">No dogs booked yet.</p>
          )}
          {dayBookings.map((b) => {
            const cancelled = isCancelled(b);
            const checkedIn = b.check_in_status === 'checked_in';
            return (
              <div
                key={b.id}
                role="listitem"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                  cancelled ? 'border-[#EAE7E2] bg-[#FAFAF8] opacity-60' : 'border-[#E2DED8] bg-white'
                }`}
              >
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}
                  aria-hidden="true"
                >
                  {b.pet_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-semibold text-[#1C1916] ${cancelled ? 'line-through' : ''}`}>
                      {b.pet_name}
                    </span>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary-tint)', color: 'var(--primary-strong)' }}>
                      {serviceShorthand(b)}
                    </span>
                    {b.requires_transport && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[#6B6762]">
                        <Van size={12} aria-hidden="true" /> PU/DO
                      </span>
                    )}
                    {b.has_behaviour_flag && <Warning size={13} weight="fill" aria-hidden="true" className="text-amber-500" />}
                    {b.has_medical_flag && <FirstAidKit size={13} weight="fill" aria-hidden="true" className="text-red-500" />}
                    {checkedIn && !cancelled && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: 'var(--primary-strong)' }}>
                        <CheckCircle size={13} weight="fill" aria-hidden="true" /> In
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B6762] truncate">
                    {b.household_name}
                    {b.planned_start_time && ` · ${b.planned_start_time}${b.planned_end_time ? `–${b.planned_end_time}` : ''}`}
                    {cancelled && (b.booking_status === 'no_show' ? ' · no-show' : ' · cancelled')}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Overnight boarders on-site this day */}
          {dayBoarders.map((s) => (
            <div
              key={s.id}
              role="listitem"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#E2DED8] bg-white"
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#EEF2FF', color: '#4338CA' }}
                aria-hidden="true"
              >
                <Moon size={16} weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-[#1C1916]">{s.petName}</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#EEF2FF', color: '#4338CA' }}>
                    Boarding
                  </span>
                </div>
                <p className="text-xs text-[#6B6762] truncate">
                  Overnight stay · {s.startDate} → {s.endDate}
                </p>
              </div>
            </div>
          ))}
        </div>

        {canCreate && (
          <div
            className="px-4 pt-3 border-t border-[#E2DED8] shrink-0"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={() => onAddBooking(date)}
              className="w-full h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--primary)' }}
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              Add booking for this day
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
