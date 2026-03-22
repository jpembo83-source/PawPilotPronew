import React, { useMemo } from 'react';
import { CalendarEvent, SERVICE_COLOURS, SourceType } from '../types';
import { Dog, Scissors, Moon, Car } from 'lucide-react';

interface WeekViewProps {
  events: CalendarEvent[];
  weekStart: Date;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: string) => void;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  daycare: Dog,
  grooming: Scissors,
  overnights: Moon,
  transport: Car,
};

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTime(dateStr: string): string {
  const timePart = dateStr.split('T')[1];
  if (!timePart) return '';
  return timePart.substring(0, 5);
}

function getDaysOfWeek(start: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export function WeekView({ events, weekStart, onEventClick, onDayClick }: WeekViewProps) {
  const days = useMemo(() => getDaysOfWeek(weekStart), [weekStart]);
  const today = dateStr(new Date());

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    days.forEach(d => map.set(dateStr(d), []));

    for (const e of events) {
      const eDate = e.start_at.split('T')[0];
      if (map.has(eDate)) {
        map.get(eDate)!.push(e);
      }

      if (e.source_type === 'overnights' && e.end_at) {
        const endDate = e.end_at.split('T')[0];
        if (endDate !== eDate) {
          const current = new Date(eDate);
          current.setDate(current.getDate() + 1);
          while (dateStr(current) <= endDate) {
            const ds = dateStr(current);
            if (map.has(ds)) {
              map.get(ds)!.push(e);
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }
    }
    return map;
  }, [events, days]);

  const MAX_VISIBLE = 3;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {days.map(d => {
          const ds = dateStr(d);
          const isToday = ds === today;
          return (
            <button
              key={ds}
              onClick={() => onDayClick(ds)}
              className={`p-2 text-center border-r border-slate-100 last:border-r-0 hover:bg-slate-50 transition-colors ${
                isToday ? 'bg-blue-50' : ''
              }`}
            >
              <div className="text-xs font-medium text-slate-400">
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map(d => {
          const ds = dateStr(d);
          const dayEvents = eventsByDay.get(ds) || [];
          const uniqueEvents = dayEvents.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);
          const visible = uniqueEvents.slice(0, MAX_VISIBLE);
          const overflow = uniqueEvents.length - MAX_VISIBLE;
          const isToday = ds === today;

          return (
            <div
              key={ds}
              className={`border-r border-slate-100 last:border-r-0 p-1.5 space-y-1 ${
                isToday ? 'bg-blue-50/30' : ''
              }`}
            >
              {visible.map(e => {
                const colours = SERVICE_COLOURS[e.source_type];
                const Icon = SOURCE_ICONS[e.source_type] || Dog;
                return (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className={`w-full flex items-center gap-1 px-1.5 py-1 rounded border-l-2 ${colours.bg} ${colours.border} text-left cursor-pointer hover:shadow-sm transition-all`}
                  >
                    <Icon className={`h-3 w-3 ${colours.text} shrink-0`} />
                    <span className={`text-[10px] font-medium ${colours.text} truncate`}>{e.pet_name}</span>
                  </button>
                );
              })}
              {overflow > 0 && (
                <button
                  onClick={() => onDayClick(ds)}
                  className="w-full text-[10px] text-slate-400 hover:text-slate-600 text-center py-0.5"
                >
                  +{overflow} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
