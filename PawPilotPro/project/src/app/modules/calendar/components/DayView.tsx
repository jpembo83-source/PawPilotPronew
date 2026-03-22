import React, { useMemo, useState } from 'react';
import { CalendarEvent, SERVICE_COLOURS, SERVICE_LABELS, SourceType, GroupBy } from '../types';
import { Dog, Scissors, Moon, Car, ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle2, Circle, LogIn, LogOut } from 'lucide-react';

interface DayViewProps {
  events: CalendarEvent[];
  date: string;
  groupBy: GroupBy;
  onEventClick: (event: CalendarEvent) => void;
  locationMap: Record<string, string>;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  daycare: Dog,
  grooming: Scissors,
  overnights: Moon,
  transport: Car,
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; icon: React.ElementType }> = {
  confirmed: { label: 'Expected', dot: 'bg-amber-400', bg: 'bg-amber-50', icon: Circle },
  scheduled: { label: 'Scheduled', dot: 'bg-amber-400', bg: 'bg-amber-50', icon: Circle },
  checked_in: { label: 'Checked In', dot: 'bg-green-500', bg: 'bg-green-50', icon: LogIn },
  in_progress: { label: 'In Progress', dot: 'bg-blue-500', bg: 'bg-blue-50', icon: Clock },
  completed: { label: 'Collected', dot: 'bg-slate-400', bg: 'bg-slate-50', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', dot: 'bg-red-400', bg: 'bg-red-50', icon: AlertTriangle },
  in_transit: { label: 'In Transit', dot: 'bg-orange-500', bg: 'bg-orange-50', icon: Car },
  pending_assignment: { label: 'Pending', dot: 'bg-amber-400', bg: 'bg-amber-50', icon: Circle },
};

function getStatusGroup(status: string): 'expected' | 'active' | 'done' {
  if (['checked_in', 'in_progress', 'in_transit'].includes(status)) return 'active';
  if (['completed', 'cancelled'].includes(status)) return 'done';
  return 'expected';
}

function formatTime(dateStr: string): string {
  const timePart = dateStr.split('T')[1];
  if (!timePart) return '';
  return timePart.substring(0, 5);
}

function getTimeMinutes(dateStr: string): number {
  const timePart = dateStr.split('T')[1];
  if (!timePart) return 8 * 60;
  const parts = timePart.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function getServiceLabel(serviceType?: string): string {
  if (!serviceType) return '';
  return serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

interface DogChipProps {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
}

function DogChip({ event, onClick, compact }: DogChipProps) {
  const colours = SERVICE_COLOURS[event.source_type];
  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.confirmed;
  const Icon = SOURCE_ICONS[event.source_type] || Dog;

  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${colours.border} ${colours.bg} px-2.5 py-1.5 text-left`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot}`} />
      <Icon className={`h-3.5 w-3.5 ${colours.text} shrink-0 opacity-60`} />
      <span className={`text-xs font-semibold ${colours.text} truncate max-w-[120px]`}>{event.pet_name}</span>
      {!compact && event.household_name && (
        <span className={`text-[10px] ${colours.text} opacity-50 truncate max-w-[80px] hidden sm:inline`}>{event.household_name}</span>
      )}
      {!compact && (
        <span className={`text-[10px] ${colours.text} opacity-40 shrink-0 ml-auto`}>
          {formatTime(event.start_at)}–{formatTime(event.end_at)}
        </span>
      )}
      {event.flags.length > 0 && (
        <span className="flex gap-0.5 shrink-0">
          {event.flags.includes('transport') && <Car className={`h-3 w-3 ${colours.text} opacity-40`} />}
          {event.flags.includes('special_needs') && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          {event.flags.includes('trial') && <span className={`text-[9px] font-bold ${colours.text} opacity-60`}>T</span>}
        </span>
      )}
    </button>
  );
}

interface CapacityRibbonProps {
  events: CalendarEvent[];
}

function CapacityRibbon({ events }: CapacityRibbonProps) {
  const slots = useMemo(() => {
    const slotData: { hour: number; count: number }[] = [];
    for (let h = 6; h <= 19; h++) {
      const mins = h * 60;
      let count = 0;
      for (const e of events) {
        const start = getTimeMinutes(e.start_at);
        const end = getTimeMinutes(e.end_at);
        if (start <= mins && end > mins && e.status !== 'cancelled') count++;
      }
      slotData.push({ hour: h, count });
    }
    return slotData;
  }, [events]);

  const maxCount = Math.max(...slots.map(s => s.count), 1);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Occupancy Timeline</span>
        <span className="text-[10px] text-slate-400 ml-auto">Peak: {maxCount} dogs</span>
      </div>
      <div className="flex gap-px h-10 items-end">
        {slots.map(({ hour, count }) => {
          const pct = (count / maxCount) * 100;
          const ragColor = count === 0 ? 'bg-slate-200'
            : pct < 50 ? 'bg-emerald-400'
            : pct < 75 ? 'bg-amber-400'
            : 'bg-red-400';
          return (
            <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 4)}%` }}>
                <div className={`w-full h-full rounded-t-sm ${ragColor} group-hover:opacity-80 transition-opacity`} />
              </div>
              <span className="text-[9px] text-slate-400 leading-none">{hour.toString().padStart(2, '0')}</span>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                {count} dogs at {hour.toString().padStart(2, '0')}:00
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StatusSectionProps {
  label: string;
  icon: React.ElementType;
  events: CalendarEvent[];
  dotColor: string;
  onEventClick: (e: CalendarEvent) => void;
}

function StatusSection({ label, icon: SectionIcon, events, dotColor, onEventClick }: StatusSectionProps) {
  if (events.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-slate-400">({events.length})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {events.map(e => (
          <DogChip key={e.id} event={e} onClick={() => onEventClick(e)} />
        ))}
      </div>
    </div>
  );
}

interface ServiceLaneProps {
  sourceType: SourceType;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  defaultOpen?: boolean;
}

function ServiceLane({ sourceType, events, onEventClick, defaultOpen = true }: ServiceLaneProps) {
  const [open, setOpen] = useState(defaultOpen);
  const colours = SERVICE_COLOURS[sourceType];
  const Icon = SOURCE_ICONS[sourceType] || Dog;

  const expected = events.filter(e => getStatusGroup(e.status) === 'expected');
  const active = events.filter(e => getStatusGroup(e.status) === 'active');
  const done = events.filter(e => getStatusGroup(e.status) === 'done');

  return (
    <div className={`rounded-xl border ${colours.border} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 ${colours.bg} cursor-pointer hover:opacity-90 transition-opacity`}
      >
        <Icon className={`h-4.5 w-4.5 ${colours.text}`} />
        <span className={`text-sm font-bold ${colours.text}`}>{SERVICE_LABELS[sourceType]}</span>
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className={`text-xs font-medium ${colours.text} opacity-70`}>{expected.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className={`text-xs font-medium ${colours.text} opacity-70`}>{active.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className={`text-xs font-medium ${colours.text} opacity-70`}>{done.length}</span>
          </div>
          {open ? <ChevronDown className={`h-4 w-4 ${colours.text} opacity-50`} /> : <ChevronRight className={`h-4 w-4 ${colours.text} opacity-50`} />}
        </div>
      </button>
      {open && (
        <div className="bg-white p-3 space-y-3">
          <StatusSection label="Expected" icon={Circle} events={expected} dotColor="bg-amber-400" onEventClick={onEventClick} />
          <StatusSection label="Checked In" icon={LogIn} events={active} dotColor="bg-green-500" onEventClick={onEventClick} />
          <StatusSection label="Collected" icon={CheckCircle2} events={done} dotColor="bg-slate-400" onEventClick={onEventClick} />
          {events.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No bookings</p>}
        </div>
      )}
    </div>
  );
}

interface TimeBlockProps {
  label: string;
  timeRange: string;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

function TimeBlock({ label, timeRange, events, onEventClick }: TimeBlockProps) {
  const [open, setOpen] = useState(events.length > 0);
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-[10px] text-slate-300">{timeRange}</span>
        <span className="text-[10px] text-slate-300 ml-auto">No activity</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
      >
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="text-[10px] text-slate-400">{timeRange}</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-bold text-slate-600">{events.length}</span>
          <span className="text-[10px] text-slate-400">dogs</span>
          {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="p-3 bg-white">
          <div className="flex flex-wrap gap-1.5">
            {events.map(e => (
              <DogChip key={e.id} event={e} onClick={() => onEventClick(e)} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TIME_BLOCKS = [
  { label: 'Early Morning', range: '06:00 – 08:00', start: 360, end: 480 },
  { label: 'Morning', range: '08:00 – 10:00', start: 480, end: 600 },
  { label: 'Late Morning', range: '10:00 – 12:00', start: 600, end: 720 },
  { label: 'Midday', range: '12:00 – 14:00', start: 720, end: 840 },
  { label: 'Afternoon', range: '14:00 – 16:00', start: 840, end: 960 },
  { label: 'Late Afternoon', range: '16:00 – 18:00', start: 960, end: 1080 },
  { label: 'Evening', range: '18:00 – 20:00', start: 1080, end: 1200 },
];

export function DayView({ events, date, groupBy, onEventClick, locationMap }: DayViewProps) {
  const byService = useMemo(() => {
    const map: Record<SourceType, CalendarEvent[]> = { daycare: [], grooming: [], overnights: [], transport: [] };
    for (const e of events) map[e.source_type]?.push(e);
    return map;
  }, [events]);

  const byLocation = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.location_id || 'unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const byStaff = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.assigned_staff || 'Unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const byTimeBlock = useMemo(() => {
    return TIME_BLOCKS.map(block => {
      const blockEvents = events.filter(e => {
        const start = getTimeMinutes(e.start_at);
        const end = getTimeMinutes(e.end_at);
        return start < block.end && end > block.start && e.status !== 'cancelled';
      });
      return { ...block, events: blockEvents };
    });
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Dog className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">No bookings for this day</p>
        <p className="text-xs text-slate-400 mt-1">Navigate to a different date or adjust your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CapacityRibbon events={events} />

      {groupBy === 'time' && (
        <div className="space-y-2">
          {byTimeBlock.map(block => (
            <TimeBlock
              key={block.label}
              label={block.label}
              timeRange={block.range}
              events={block.events}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      )}

      {groupBy === 'feature' && (
        <div className="space-y-3">
          {(['daycare', 'grooming', 'overnights', 'transport'] as SourceType[]).map(type => {
            if (byService[type].length === 0) return null;
            return (
              <ServiceLane
                key={type}
                sourceType={type}
                events={byService[type]}
                onEventClick={onEventClick}
              />
            );
          })}
        </div>
      )}

      {groupBy === 'location' && (
        <div className="space-y-3">
          {Array.from(byLocation.entries()).map(([locId, evts]) => {
            const name = locationMap[locId] || locId;
            const expected = evts.filter(e => getStatusGroup(e.status) === 'expected');
            const active = evts.filter(e => getStatusGroup(e.status) === 'active');
            const done = evts.filter(e => getStatusGroup(e.status) === 'done');
            return (
              <div key={locId} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="text-sm font-bold text-slate-700">{name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{evts.length} bookings</span>
                </div>
                <div className="bg-white p-3 space-y-3">
                  <StatusSection label="Expected" icon={Circle} events={expected} dotColor="bg-amber-400" onEventClick={onEventClick} />
                  <StatusSection label="Checked In" icon={LogIn} events={active} dotColor="bg-green-500" onEventClick={onEventClick} />
                  <StatusSection label="Collected" icon={CheckCircle2} events={done} dotColor="bg-slate-400" onEventClick={onEventClick} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {groupBy === 'staff' && (
        <div className="space-y-3">
          {Array.from(byStaff.entries()).map(([staff, evts]) => {
            const expected = evts.filter(e => getStatusGroup(e.status) === 'expected');
            const active = evts.filter(e => getStatusGroup(e.status) === 'active');
            const done = evts.filter(e => getStatusGroup(e.status) === 'done');
            return (
              <div key={staff} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="text-sm font-bold text-slate-700">{staff}</span>
                  <span className="text-xs text-slate-400 ml-auto">{evts.length} bookings</span>
                </div>
                <div className="bg-white p-3 space-y-3">
                  <StatusSection label="Expected" icon={Circle} events={expected} dotColor="bg-amber-400" onEventClick={onEventClick} />
                  <StatusSection label="Checked In" icon={LogIn} events={active} dotColor="bg-green-500" onEventClick={onEventClick} />
                  <StatusSection label="Collected" icon={CheckCircle2} events={done} dotColor="bg-slate-400" onEventClick={onEventClick} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
