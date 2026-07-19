import React, { useState, useEffect } from 'react';
import { CaretLeft, CaretRight, Bed, Warning } from '@phosphor-icons/react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { useOvernightsStore } from '../store';
import { CapacitySnapshot } from '../types';

interface CapacityCalendarProps {
  locationId: string;
  maxCapacity: number;
}

function getNext14Days(startDate: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getCapacityColour(occupancy: number, max: number): string {
  if (max === 0) return 'bg-muted text-muted-foreground';
  const pct = (occupancy / max) * 100;
  if (pct >= 90) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (pct >= 75) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (pct >= 50) return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function getBarColour(occupancy: number, max: number): string {
  if (max === 0) return 'bg-muted';
  const pct = (occupancy / max) * 100;
  if (pct >= 90) return 'bg-rose-500';
  if (pct >= 75) return 'bg-amber-500';
  if (pct >= 50) return 'bg-blue-500';
  return 'bg-emerald-500';
}

export function CapacityCalendar({ locationId, maxCapacity }: CapacityCalendarProps) {
  const { getCapacitySnapshot } = useOvernightsStore();
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [snapshots, setSnapshots] = useState<Record<string, CapacitySnapshot>>({});
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());

  const days = getNext14Days(startDate);

  useEffect(() => {
    const loadSnapshots = async () => {
      const datesToLoad = days.map(d => formatDateISO(d)).filter(d => !snapshots[d]);
      if (datesToLoad.length === 0) return;

      setLoadingDates(new Set(datesToLoad));

      const results: Record<string, CapacitySnapshot> = {};
      await Promise.allSettled(
        datesToLoad.map(async (date) => {
          try {
            const snapshot = await getCapacitySnapshot(locationId, date);
            results[date] = snapshot;
          } catch {
            results[date] = {
              date,
              locationId,
              maxCapacity,
              currentOccupancy: 0,
              availableSlots: maxCapacity,
              reservations: [],
            };
          }
        })
      );

      setSnapshots(prev => ({ ...prev, ...results }));
      setLoadingDates(new Set());
    };

    loadSnapshots();
  }, [startDate, locationId]);

  const handlePrevious = () => {
    const newStart = new Date(startDate);
    newStart.setDate(startDate.getDate() - 14);
    setStartDate(newStart);
  };

  const handleNext = () => {
    const newStart = new Date(startDate);
    newStart.setDate(startDate.getDate() + 14);
    setStartDate(newStart);
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(today);
  };

  const todayStr = formatDateISO(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <CaretLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <CaretRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span>&lt;50%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span>50–74%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span>75–89%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-rose-500" />
            <span>90%+</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr = formatDateISO(day);
          const snapshot = snapshots[dateStr];
          const isToday = dateStr === todayStr;
          const isLoading = loadingDates.has(dateStr);
          const occupancy = snapshot?.currentOccupancy ?? 0;
          // Bookable capacity (max minus buffer) — the same number the
          // server enforces at booking time.
          const max = snapshot?.effectiveCapacity ?? snapshot?.maxCapacity ?? maxCapacity;
          const available = snapshot?.availableSlots ?? max - occupancy;
          const pct = max > 0 ? Math.round((occupancy / max) * 100) : 0;

          return (
            <div
              key={dateStr}
              className={`border rounded-lg p-3 transition-all ${
                isToday ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              } ${isLoading ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                <span className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {day.getDate()}
                </span>
              </div>

              {isLoading ? (
                <div className="h-8 bg-muted rounded" />
              ) : (
                <>
                  <div className="flex items-baseline gap-1 mb-1.5">
                    <span className="text-lg font-bold text-foreground">{occupancy}</span>
                    <span className="text-sm text-tertiary-foreground">/ {max}</span>
                  </div>

                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${getBarColour(occupancy, max)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${available > 0 ? 'text-muted-foreground' : 'text-rose-600 font-medium'}`}>
                      {available > 0 ? `${available} free` : 'Full'}
                    </span>
                    {pct >= 90 && (
                      <Warning className="h-3 w-3 text-rose-500" />
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
