import React, { useEffect, useState } from 'react';
import { useCapacityStore } from './store';
import { useDashboardStore } from '../dashboard/store';
import { useSettingsStore } from '../settings/store';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Dog,
  Scissors,
  Moon,
  Truck,
} from '@phosphor-icons/react';
import type { ServiceCapacity, DailyCapacitySummary } from './types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

const SERVICES = [
  { id: 'daycare',    label: 'Daycare',    Icon: Dog,      color: 'var(--primary)' },
  { id: 'grooming',   label: 'Grooming',   Icon: Scissors, color: '#7C3AED' },
  { id: 'overnights', label: 'Overnights', Icon: Moon,     color: '#4F46E5' },
  { id: 'transport',  label: 'Transport',  Icon: Truck,    color: '#D97706' },
] as const;

function statusColors(status: ServiceCapacity['status']) {
  switch (status) {
    case 'available':  return { bar: '#22c55e', bg: '#f0fdf4', text: '#15803d', label: 'Available' };
    case 'limited':    return { bar: '#f59e0b', bg: '#fffbeb', text: '#b45309', label: 'Limited' };
    case 'full':       return { bar: '#ef4444', bg: '#fef2f2', text: '#b91c1c', label: 'Full' };
    case 'overbooked': return { bar: '#7f1d1d', bg: '#fee2e2', text: '#7f1d1d', label: 'Overbooked' };
    default:           return { bar: '#cbd5e1', bg: '#f8fafc', text: '#64748b', label: 'Unknown' };
  }
}

// ── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({ service, capacity }: { service: typeof SERVICES[number]; capacity: ServiceCapacity | null }) {
  const { Icon, label, color } = service;

  if (!capacity || capacity.total_capacity === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-slate-200 opacity-50">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Icon size={18} style={{ color: '#94a3b8' }} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-xs text-slate-400">Not configured</p>
        </div>
      </div>
    );
  }

  const sc = statusColors(capacity.status);
  const pct = Math.min(capacity.utilization_percent, 100);

  return (
    <div className="p-4 rounded-2xl border bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-400">{capacity.booked} / {capacity.total_capacity} booked</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
          {sc.label}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sc.bar }} />
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-xs text-slate-500">{capacity.available} available</span>
        <span className="text-xs font-semibold text-slate-700">{pct}%</span>
      </div>
    </div>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({ day, isSelected, isToday, onClick }: {
  day: DailyCapacitySummary;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const date = new Date(day.date);
  const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNum = date.getDate();

  const services = [day.daycare, day.grooming, day.overnights, day.transport].filter(Boolean);
  const hasOverbooked = services.some(s => s?.status === 'overbooked');
  const hasFull       = services.some(s => s?.status === 'full');
  const hasLimited    = services.some(s => s?.status === 'limited');
  const status = hasOverbooked ? 'overbooked' : hasFull ? 'full' : hasLimited ? 'limited' : 'available';
  const sc = statusColors(status as ServiceCapacity['status']);

  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center py-3 px-2 rounded-xl transition-all min-w-[52px]"
      style={{
        background: isSelected ? 'var(--primary-tint)' : isToday ? '#f8fafc' : 'transparent',
        border: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
        outline: isToday && !isSelected ? '2px solid #e2e8f0' : 'none',
        outlineOffset: '-2px',
      }}
    >
      <span className="text-xs font-medium" style={{ color: isToday ? 'var(--primary)' : '#94a3b8' }}>
        {dayName}
      </span>
      <span className="text-lg font-bold mt-0.5" style={{ color: isSelected ? 'var(--primary)' : '#1e293b' }}>
        {dayNum}
      </span>
      <div className="flex gap-0.5 mt-1.5">
        {day.daycare    && day.daycare.total_capacity > 0    && <Dot status={day.daycare.status} />}
        {day.grooming   && day.grooming.total_capacity > 0   && <Dot status={day.grooming.status} />}
        {day.overnights && day.overnights.total_capacity > 0 && <Dot status={day.overnights.status} />}
        {day.transport  && day.transport.total_capacity > 0  && <Dot status={day.transport.status} />}
      </div>
    </button>
  );
}

function Dot({ status }: { status: ServiceCapacity['status'] }) {
  return <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors(status).bar }} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CapacityDashboard() {
  const { selectedLocationId } = useDashboardStore();
  const { globalEnabledModules } = useSettingsStore();
  const {
    weeklyView,
    selectedDate,
    dailySummary,
    isLoading,
    setSelectedDate,
    fetchWeeklyCapacity,
    fetchDailyCapacity,
  } = useCapacityStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));

  useEffect(() => {
    fetchWeeklyCapacity(formatDate(currentWeekStart), selectedLocationId);
    fetchDailyCapacity(selectedDate, selectedLocationId);
  }, [currentWeekStart, selectedLocationId]);

  const goToPrev  = () => { const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); setCurrentWeekStart(d); };
  const goToNext  = () => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + 7); setCurrentWeekStart(d); };
  const goToToday = () => { setCurrentWeekStart(getWeekStart(new Date())); setSelectedDate(formatDate(new Date())); };

  const today = formatDate(new Date());
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRange = `${currentWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const enabledServices = SERVICES.filter(s => globalEnabledModules.includes(s.id) || s.id === 'daycare');

  const selectedLabel = new Date(selectedDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="p-5 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Capacity</h1>
          <p className="text-sm text-slate-500 mt-0.5">Availability across all services</p>
        </div>
        <button
          onClick={goToToday}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border hover:bg-slate-50 transition-colors"
        >
          <CalendarBlank size={15} />
          Today
        </button>
      </div>

      {/* Week strip */}
      <div className="bg-white rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrev} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <CaretLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-slate-700">{weekRange}</span>
          <button onClick={goToNext} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <CaretRight size={18} />
          </button>
        </div>

        {isLoading && !weeklyView ? (
          <div className="flex gap-2">
            {[...Array(7)].map((_, i) => <Skeleton key={i} className="flex-1 h-20 rounded-xl" />)}
          </div>
        ) : weeklyView ? (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {weeklyView.days.map(day => (
              <DayCell
                key={day.date}
                day={day}
                isSelected={day.date === selectedDate}
                isToday={day.date === today}
                onClick={() => setSelectedDate(day.date)}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-slate-400 py-6">No data</p>
        )}

        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t text-xs text-slate-400">
          {(['available','limited','full'] as ServiceCapacity['status'][]).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: statusColors(s).bar }} />
              <span className="capitalize">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day detail */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">{selectedLabel}</h2>
          {selectedDate === today && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}>
              Today
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {enabledServices.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                capacity={dailySummary?.[service.id as keyof DailyCapacitySummary] as ServiceCapacity | null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CapacityDashboard;
