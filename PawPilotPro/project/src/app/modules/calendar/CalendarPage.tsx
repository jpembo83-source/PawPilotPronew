import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, X, Search, LayoutList, LayoutGrid, Clock } from 'lucide-react';
import { CalendarEvent, CalendarSummary, CalendarView, GroupBy, SourceType, SERVICE_COLOURS, SERVICE_LABELS } from './types';
import { fetchCalendarEvents, FetchCalendarParams } from './api';
import { useAuth } from '../../context/AuthContext';
import { useDashboardStore } from '../dashboard/store';
import { useSettingsStore } from '../settings/store';
import { Legend } from './components/Legend';
import { DayView } from './components/DayView';
import { WeekView } from './components/WeekView';
import { AgendaView } from './components/AgendaView';
import { EventDetailPanel } from './components/EventDetailPanel';

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const ws = new Date(d);
  ws.setDate(diff);
  ws.setHours(0, 0, 0, 0);
  return ws;
}

function getWeekEnd(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function formatDateHeading(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatWeekHeading(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} — ${end.getDate()} ${start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function CalendarPage() {
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();

  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const loc of locations) {
      map[loc.id] = loc.name;
    }
    return map;
  }, [locations]);

  const [view, setView] = useState<CalendarView>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [groupBy, setGroupBy] = useState<GroupBy>('time');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState<Set<SourceType>>(new Set(['daycare', 'grooming', 'overnights', 'transport']));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const locationId = selectedLocationId === 'ALL' ? undefined : selectedLocationId;

  const { startDate, endDate } = useMemo(() => {
    if (view === 'week') {
      const ws = getWeekStart(currentDate);
      return { startDate: dateStr(ws), endDate: dateStr(getWeekEnd(ws)) };
    }
    const ds = dateStr(currentDate);
    return { startDate: ds, endDate: ds };
  }, [view, currentDate]);

  const loadEvents = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const params: FetchCalendarParams = {
        start_date: startDate,
        end_date: endDate,
        location_id: locationId,
      };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) {
        params.pet = searchQuery;
        params.household = searchQuery;
      }

      const data = await fetchCalendarEvents(params);
      setEvents(data.events || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error('[Calendar] Error:', err);
      setError(err.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate, locationId, statusFilter, searchQuery]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => activeFeatures.has(e.source_type));
  }, [events, activeFeatures]);

  const toggleFeature = useCallback((feature: SourceType) => {
    setActiveFeatures(prev => {
      const next = new Set(prev);
      if (next.has(feature)) {
        if (next.size > 1) next.delete(feature);
      } else {
        next.add(feature);
      }
      return next;
    });
  }, []);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (view === 'week' ? 7 : 1));
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (view === 'week' ? 7 : 1));
    setCurrentDate(d);
  };

  const handleDayClick = (ds: string) => {
    setCurrentDate(new Date(ds + 'T00:00:00'));
    setView('day');
  };

  const isToday = dateStr(currentDate) === dateStr(new Date());

  const heading = view === 'week'
    ? formatWeekHeading(getWeekStart(currentDate), getWeekEnd(getWeekStart(currentDate)))
    : formatDateHeading(currentDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-[var(--primary)]" />
            Operations Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Unified view of all scheduled activity across services.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setView('day')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'day' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'week' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />Week
            </button>
            <button
              onClick={() => setView('agenda')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'agenda' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />Agenda
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-1.5 rounded-md hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <button
            onClick={goToday}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              isToday ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Today
          </button>
          <button onClick={goNext} className="p-1.5 rounded-md hover:bg-slate-100 transition-colors">
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
          <h2 className="text-sm font-semibold text-slate-800 ml-2">{heading}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Legend activeFeatures={activeFeatures} onToggle={toggleFeature} />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Filters</span>
            <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-slate-100">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Search pet or household</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_transit">In Transit</option>
              </select>
            </div>
            {view === 'day' && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Group by</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="time">By Time</option>
                  <option value="feature">By Service</option>
                  <option value="location">By Location</option>
                  <option value="staff">By Staff</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
          <div className="text-lg font-bold text-slate-800">{summary?.total ?? 0}</div>
          <div className="text-[10px] font-medium text-slate-400 uppercase">Total</div>
        </div>
        {(['daycare', 'grooming', 'overnights', 'transport'] as SourceType[]).map(s => {
          const c = SERVICE_COLOURS[s];
          return (
            <div key={s} className={`rounded-lg border ${c.border} px-3 py-2 text-center ${c.light}`}>
              <div className={`text-lg font-bold ${c.text}`}>{summary?.[s] ?? 0}</div>
              <div className={`text-[10px] font-medium ${c.text} opacity-70 uppercase`}>{SERVICE_LABELS[s]}</div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-[var(--primary)] rounded-full" />
        </div>
      ) : (
        <>
          {view === 'day' && (
            <DayView
              events={filteredEvents}
              date={dateStr(currentDate)}
              groupBy={groupBy}
              onEventClick={setSelectedEvent}
              locationMap={locationMap}
            />
          )}
          {view === 'week' && (
            <WeekView
              events={filteredEvents}
              weekStart={getWeekStart(currentDate)}
              onEventClick={setSelectedEvent}
              onDayClick={handleDayClick}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              events={filteredEvents}
              onEventClick={setSelectedEvent}
              locationMap={locationMap}
            />
          )}
        </>
      )}

      {selectedEvent && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedEvent(null)} />
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            locationName={selectedEvent.location_id ? locationMap[selectedEvent.location_id] : undefined}
          />
        </>
      )}
    </div>
  );
}
