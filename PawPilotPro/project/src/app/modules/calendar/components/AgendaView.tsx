import React, { useMemo } from 'react';
import { CalendarEvent, SERVICE_COLOURS, SERVICE_LABELS, SourceType } from '../types';
import { Dog, Scissors, Moon, Car, Clock, User, MapPin } from 'lucide-react';

interface AgendaViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  locationMap: Record<string, string>;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  daycare: Dog,
  grooming: Scissors,
  overnights: Moon,
  transport: Car,
};

function formatTime(dateStr: string): string {
  const timePart = dateStr.split('T')[1];
  if (!timePart) return '';
  return timePart.substring(0, 5);
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  let prefix = '';
  if (dateStr === todayStr) prefix = 'Today — ';
  else if (dateStr === tomorrowStr) prefix = 'Tomorrow — ';

  return prefix + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-amber-100 text-amber-700',
    checked_in: 'bg-blue-100 text-blue-700',
    checked_out: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-indigo-100 text-indigo-700',
    scheduled: 'bg-sky-100 text-sky-700',
    in_transit: 'bg-orange-100 text-orange-700',
    requested: 'bg-yellow-100 text-yellow-700',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

export function AgendaView({ events, onEventClick, locationMap }: AgendaViewProps) {
  const groupedByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = e.start_at.split('T')[0];
      const arr = map.get(d) || [];
      arr.push(e);
      map.set(d, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">No events in this range</p>
        <p className="text-sm mt-1">Try adjusting your filters or date range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedByDate.map(([date, dayEvents]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-slate-600 mb-2 sticky top-0 bg-[var(--background)] py-1">
            {formatDateHeading(date)}
            <span className="text-slate-400 font-normal ml-2">({dayEvents.length} events)</span>
          </h3>
          <div className="space-y-1.5">
            {dayEvents.map(e => {
              const colours = SERVICE_COLOURS[e.source_type];
              const Icon = SOURCE_ICONS[e.source_type] || Dog;
              return (
                <button
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-l-3 ${colours.light} ${colours.border} hover:shadow-sm transition-all text-left cursor-pointer group`}
                >
                  <div className={`p-1.5 rounded-md ${colours.bg}`}>
                    <Icon className={`h-4 w-4 ${colours.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{e.pet_name}</span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge(e.status)}`}>
                        {e.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(e.start_at)} — {formatTime(e.end_at)}
                      </span>
                      {e.household_name && (
                        <span className="truncate">{e.household_name}</span>
                      )}
                      {e.assigned_staff && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{e.assigned_staff}
                        </span>
                      )}
                      {e.location_id && locationMap[e.location_id] && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{locationMap[e.location_id]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-medium ${colours.text}`}>{SERVICE_LABELS[e.source_type]}</span>
                    {e.subtitle && (
                      <p className="text-[10px] text-slate-400">{e.subtitle}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
