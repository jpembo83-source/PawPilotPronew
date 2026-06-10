import React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CalendarBlank, MapPin, ArrowClockwise } from '@phosphor-icons/react';
import type { ReportFilters } from '../types';

interface Location {
  id: string;
  name: string;
}

interface Props {
  filters: ReportFilters;
  locations: Location[];
  requiresDateRange: boolean;
  isLoading: boolean;
  onFiltersChange: (partial: Partial<ReportFilters>) => void;
  onRun: () => void;
}

const PRESETS = [
  { label: 'Today', getValue: () => { const d = new Date().toISOString().split('T')[0]; return { dateFrom: d, dateTo: d }; } },
  { label: 'This Week', getValue: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); return { dateFrom: mon.toISOString().split('T')[0], dateTo: d.toISOString().split('T')[0] }; } },
  { label: 'Last 7 Days', getValue: () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 6); return { dateFrom: from.toISOString().split('T')[0], dateTo: to.toISOString().split('T')[0] }; } },
  { label: 'This Month', getValue: () => { const d = new Date(); return { dateFrom: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0], dateTo: d.toISOString().split('T')[0] }; } },
  { label: 'Last Month', getValue: () => { const d = new Date(); const first = new Date(d.getFullYear(), d.getMonth() - 1, 1); const last = new Date(d.getFullYear(), d.getMonth(), 0); return { dateFrom: first.toISOString().split('T')[0], dateTo: last.toISOString().split('T')[0] }; } },
  { label: 'Year to Date', getValue: () => { const d = new Date(); return { dateFrom: `${d.getFullYear()}-01-01`, dateTo: d.toISOString().split('T')[0] }; } },
];

export function ReportFilters({ filters, locations, requiresDateRange, isLoading, onFiltersChange, onRun }: Props) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Location */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
              <MapPin className="inline h-3 w-3 mr-1" />Location
            </label>
            <select
              value={filters.locationId}
              onChange={(e) => onFiltersChange({ locationId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="ALL">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          {requiresDateRange && (
            <>
              <div className="min-w-[150px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  <CalendarBlank className="inline h-3 w-3 mr-1" />From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  max={filters.dateTo}
                  onChange={(e) => onFiltersChange({ dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom}
                  onChange={(e) => onFiltersChange({ dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}

          {/* Include Inactive */}
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeInactive}
                onChange={(e) => onFiltersChange({ includeInactive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              Include inactive
            </label>
          </div>

          {/* Run */}
          <div className="flex items-end">
            <Button
              onClick={onRun}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <><ArrowClockwise className="h-4 w-4 mr-2 animate-spin" />Running…</>
              ) : (
                <><ArrowClockwise className="h-4 w-4 mr-2" />Run Report</>
              )}
            </Button>
          </div>
        </div>

        {/* Quick presets */}
        {requiresDateRange && (
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => onFiltersChange(preset.getValue())}
                className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
