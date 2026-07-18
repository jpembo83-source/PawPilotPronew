// My Shifts — the signed-in user's upcoming rota shifts.
// Staff rotate between locations, so the location is the loudest part of
// each row. Data comes from GET /my-rota (already tenant- and user-scoped
// server-side); this card is the first consumer of that endpoint.

import React, { useEffect, useState } from 'react';
import { CalendarBlank, MapPin, Clock } from '@phosphor-icons/react';
import { useStaffStore } from '../../staff/store';
import { useSettingsStore } from '../../settings/store';
import type { RotaShift } from '../../staff/types';

const MAX_ROWS = 6;

function dayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today';
  const date = new Date(`${dateStr}T00:00:00`);
  const tomorrow = new Date(`${todayStr}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function roleLabel(shift: RotaShift): string {
  const raw = shift.role_name || shift.role_key || '';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function MyShiftsCard() {
  const { myRota, fetchMyRota } = useStaffStore();
  const { locations, fetchLocations } = useSettingsStore();
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (locations.length === 0) void fetchLocations();
    void (async () => {
      await fetchMyRota();
      setLoading(false);
    })();
  }, []);

  const upcoming = myRota
    .filter(s => s.shift_date >= today)
    .sort((a, b) =>
      a.shift_date === b.shift_date
        ? a.start_time.localeCompare(b.start_time)
        : a.shift_date.localeCompare(b.shift_date)
    );

  const locationName = (id: string) =>
    locations.find(l => l.id === id)?.name || 'Location TBC';

  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #E2DED8' }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #F0EDE8' }}>
        <div className="flex items-center gap-2">
          <CalendarBlank size={16} weight="duotone" style={{ color: 'var(--primary)' }} />
          <span className="text-sm font-semibold text-[#1C1916]">My Shifts</span>
          {upcoming.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-tint text-primary">
              {upcoming.length} upcoming
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2.5">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl animate-pulse bg-[#F4F3EF]" />)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <CalendarBlank size={36} weight="thin" className="text-[#D4CFC9] mb-2" />
          <p className="text-sm text-tertiary-foreground">No upcoming shifts scheduled</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F5F3F0]">
          {upcoming.slice(0, MAX_ROWS).map(shift => {
            const isToday = shift.shift_date === today;
            return (
              <div key={shift.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className="w-20 flex-shrink-0 text-sm font-semibold"
                  style={{ color: isToday ? 'var(--primary)' : '#1C1916' }}
                >
                  {dayLabel(shift.shift_date, today)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1916] flex items-center gap-1.5 truncate">
                    <MapPin size={14} weight="duotone" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                    <span className="truncate">{locationName(shift.location_id)}</span>
                  </p>
                  {roleLabel(shift) && (
                    <p className="text-sm text-tertiary-foreground truncate">{roleLabel(shift)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 text-sm text-[#1C1916]">
                  <Clock size={14} className="text-tertiary-foreground" aria-hidden="true" />
                  {shift.start_time} – {shift.end_time}
                </div>
              </div>
            );
          })}
          {upcoming.length > MAX_ROWS && (
            <p className="w-full py-3 text-sm font-medium text-center text-tertiary-foreground">
              +{upcoming.length - MAX_ROWS} more later this rota
            </p>
          )}
        </div>
      )}
    </div>
  );
}
