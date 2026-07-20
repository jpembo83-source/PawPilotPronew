// The paper register, digitised: seven day-columns, each listing the dogs
// booked that day with the register's shorthand. Desktop/tablet only —
// phones use the existing week strip + day drill-down, which fits 390px.

import { Plus, Van, Moon, ArrowsClockwise } from '@phosphor-icons/react';
import { usePermissions } from '../../../hooks/usePermissions';
import type { PlannerBooking } from '../types';
import {
  bookingsForDate,
  isCancelled,
  serviceShorthand,
  onSiteCount,
  overnightOnlyForDate,
  type PlannerOvernightStay,
} from './plannerFormat';

function countColors(booked: number, max: number) {
  if (max <= 0) return { bg: '#F4F3EF', text: '#6B6762' };
  const pct = (booked / max) * 100;
  if (booked > max) return { bg: '#fee2e2', text: '#7f1d1d' };
  if (pct >= 100)   return { bg: '#fef2f2', text: '#b91c1c' };
  if (pct >= 80)    return { bg: '#fffbeb', text: '#b45309' };
  return { bg: 'var(--primary-tint)', text: 'var(--primary-strong)' };
}

interface WeekPlannerGridProps {
  days: string[]; // ISO dates, Mon..Sun
  bookings: PlannerBooking[];
  /** Boarding stays overlapping the week — folded into each day they cover. */
  overnightStays?: PlannerOvernightStay[];
  maxDogs: number;
  today: string;
  selectedDate: string;
  onOpenDay: (date: string) => void;
  onAddBooking: (date: string) => void;
}

export function WeekPlannerGrid({ days, bookings, overnightStays = [], maxDogs, today, selectedDate, onOpenDay, onAddBooking }: WeekPlannerGridProps) {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('daycare', 'create');

  return (
    <div className="hidden md:grid grid-cols-7 gap-2" role="grid" aria-label="Week planner — dogs on-site per day">
      {days.map((date) => {
        const dayBookings = bookingsForDate(bookings, date);
        // Boarders present that day whose dog isn't already a daycare booking
        // (a converging dog is shown/counted once, via its daycare line).
        const dayBoarders = overnightOnlyForDate(bookings, overnightStays, date);
        const booked = onSiteCount(bookings, overnightStays, date);
        const cc = countColors(booked, maxDogs);
        const d = new Date(`${date}T12:00:00`);
        const isToday = date === today;
        const isSelected = date === selectedDate;

        return (
          <div
            key={date}
            role="gridcell"
            className="rounded-2xl border bg-white flex flex-col min-h-[260px]"
            style={{
              borderColor: isSelected ? 'var(--primary)' : isToday ? '#CBD5D0' : '#E2DED8',
              boxShadow: isSelected ? '0 0 0 1px var(--primary)' : undefined,
            }}
          >
            {/* Day header — whole header opens the day list */}
            <button
              onClick={() => onOpenDay(date)}
              className="px-3 pt-3 pb-2 text-left rounded-t-2xl hover:bg-[#FAFAF8] transition-colors"
              aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} — ${booked} of ${maxDogs} on-site${dayBoarders.length ? `, including ${dayBoarders.length} boarding overnight` : ''}, open day list`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium" style={{ color: isToday ? 'var(--primary)' : '#94a3b8' }}>
                  {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-tabular" style={{ background: cc.bg, color: cc.text }}>
                  {booked}/{maxDogs}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-lg font-bold" style={{ color: isToday ? 'var(--primary)' : '#1e293b' }}>
                  {d.getDate()}
                </span>
                {dayBoarders.length > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#EEF2FF', color: '#4338CA' }}
                    title={`${dayBoarders.length} boarding overnight`}
                  >
                    <Moon size={11} weight="fill" aria-hidden="true" />
                    {dayBoarders.length}
                  </span>
                )}
              </div>
            </button>

            {/* Register lines */}
            <button
              onClick={() => onOpenDay(date)}
              className="flex-1 px-3 pb-2 text-left space-y-0.5 overflow-hidden hover:bg-[#FAFAF8] transition-colors"
              aria-label={`Open list of ${dayBookings.length} dogs for ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric' })}`}
            >
              {dayBookings.slice(0, 12).map((b) => {
                const cancelled = isCancelled(b);
                return (
                  <span
                    key={b.id}
                    className={`block text-[13px] leading-snug truncate ${cancelled ? 'line-through text-[#A09893]' : 'text-[#1C1916]'}`}
                  >
                    {b.standing_booking_id && (
                      <ArrowsClockwise
                        size={11}
                        aria-label="recurring booking"
                        className="inline mr-1 text-[#6B6762] align-[-1px]"
                      />
                    )}
                    <span className="font-medium">{b.pet_name}</span>
                    <span className="text-[#6B6762]"> {serviceShorthand(b)}</span>
                    {b.requires_transport && !cancelled && (
                      <Van size={11} aria-label="pickup and drop-off" className="inline ml-1 text-[#6B6762] align-[-1px]" />
                    )}
                  </span>
                );
              })}
              {dayBookings.length > 12 && (
                <span className="block text-xs font-medium text-tertiary-foreground pt-0.5">
                  +{dayBookings.length - 12} more…
                </span>
              )}

              {/* Overnight boarders — same register, marked with a moon */}
              {dayBoarders.slice(0, Math.max(0, 12 - dayBookings.length)).map((s) => (
                <span key={s.id} className="block text-[13px] leading-snug truncate text-[#1C1916]">
                  <Moon size={11} weight="fill" aria-hidden="true" className="inline mr-1 text-[#4338CA] align-[-1px]" />
                  <span className="font-medium">{s.petName}</span>
                  <span className="text-[#6B6762]"> boarding</span>
                </span>
              ))}
              {dayBookings.length + dayBoarders.length > 12 && dayBookings.length < 12 && (
                <span className="block text-xs font-medium text-tertiary-foreground pt-0.5">
                  +{dayBookings.length + dayBoarders.length - 12} more…
                </span>
              )}

              {dayBookings.length === 0 && dayBoarders.length === 0 && (
                <span className="block text-xs text-[#C8C4BC] pt-1">—</span>
              )}
            </button>

            {canCreate && (
              <button
                onClick={() => onAddBooking(date)}
                className="mx-2 mb-2 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors hover:bg-[var(--primary-tint)]"
                style={{ color: 'var(--primary-strong)' }}
                aria-label={`Add booking for ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}
              >
                <Plus size={12} weight="bold" aria-hidden="true" />
                Add
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
