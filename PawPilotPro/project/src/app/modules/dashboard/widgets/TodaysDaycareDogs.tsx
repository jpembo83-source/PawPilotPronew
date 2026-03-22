// Today's Daycare Dogs Widget - Dashboard
// Displays all dogs scheduled for daycare today with check-in/out functionality

import React, { useState, useEffect } from 'react';
import { WidgetCard } from './WidgetCard';
import { Dog, Search, RefreshCw, AlertTriangle, FileWarning, Ban, Activity, Clock, ChevronRight } from 'lucide-react';
import { useDaycareStore } from '../../daycare/store';
import { useDashboardStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { cn } from '../../../components/ui/utils';
import type { DaycareBooking, CheckInStatus } from '../../daycare/types';
import { SERVICE_TYPES } from '../../daycare/types';
import { DogDetailsPanel } from './DogDetailsPanel';

type FilterType = 'all' | 'not_checked_in' | 'checked_in' | 'checked_out' | 'alerts_only';

export function TodaysDaycareDogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedBooking, setSelectedBooking] = useState<DaycareBooking | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const { bookings, fetchBookings, isLoading, error } = useDaycareStore();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Fetch bookings on mount and when location changes
  useEffect(() => {
    loadBookings();
  }, [selectedLocationId]);

  const loadBookings = async () => {
    try {
      await fetchBookings({
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
        date: today,
        booking_status: 'confirmed',
      });
    } catch (err) {
      console.error('Failed to load today\'s daycare bookings:', err);
    }
  };

  // Filter and search bookings
  const filteredBookings = bookings.filter(booking => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        booking.pet_name.toLowerCase().includes(term) ||
        booking.household_name.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filter !== 'all') {
      if (filter === 'not_checked_in' && booking.check_in_status !== 'not_checked_in') return false;
      if (filter === 'checked_in' && booking.check_in_status !== 'checked_in') return false;
      if (filter === 'checked_out' && booking.check_in_status !== 'checked_out') return false;
      if (filter === 'alerts_only') {
        const hasAlert = 
          booking.vaccination_status === 'expired' ||
          booking.vaccination_status === 'expiring_soon' ||
          booking.waiver_status === 'expired' ||
          booking.waiver_status === 'expiring_soon' ||
          booking.has_booking_hold ||
          booking.has_payment_hold ||
          booking.has_behaviour_flag ||
          booking.has_medical_flag;
        if (!hasAlert) return false;
      }
    }

    return true;
  });

  // Sort bookings: not_checked_in first, then checked_in, then checked_out
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const statusOrder: Record<CheckInStatus, number> = {
      not_checked_in: 0,
      checked_in: 1,
      checked_out: 2,
    };
    
    const orderDiff = statusOrder[a.check_in_status] - statusOrder[b.check_in_status];
    if (orderDiff !== 0) return orderDiff;

    // Within same status, sort by planned start time or pet name
    if (a.planned_start_time && b.planned_start_time) {
      return a.planned_start_time.localeCompare(b.planned_start_time);
    }
    return a.pet_name.localeCompare(b.pet_name);
  });

  // Count by status
  const counts = {
    total: bookings.length,
    not_checked_in: bookings.filter(b => b.check_in_status === 'not_checked_in').length,
    checked_in: bookings.filter(b => b.check_in_status === 'checked_in').length,
    checked_out: bookings.filter(b => b.check_in_status === 'checked_out').length,
  };

  // Get location context
  const locationContext = selectedLocationId === 'ALL' 
    ? 'All Locations' 
    : locations.find(l => l.id === selectedLocationId)?.name || 'Unknown Location';

  const handleBookingClick = (booking: DaycareBooking) => {
    setSelectedBooking(booking);
    setIsPanelOpen(true);
  };

  const handlePanelClose = () => {
    setIsPanelOpen(false);
    setSelectedBooking(null);
  };

  const handleActionComplete = async () => {
    // Refresh bookings after check-in or check-out
    await loadBookings();
    handlePanelClose();
  };

  return (
    <>
      <WidgetCard title="Today's Daycare Dogs" icon={Dog}>
        <div className="flex flex-col h-full">
          {/* Header with counts and location */}
          <div className="mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{counts.total}</span> scheduled
                </div>
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-blue-600">{counts.checked_in}</span> in daycare
                </div>
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-green-600">{counts.checked_out}</span> collected
                </div>
              </div>
              <button
                onClick={loadBookings}
                disabled={isLoading}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </button>
            </div>
            <div className="text-xs text-slate-500">
              {locationContext}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by dog or household name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {(['all', 'not_checked_in', 'checked_in', 'checked_out', 'alerts_only'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    filter === f
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {f === 'all' && 'All'}
                  {f === 'not_checked_in' && 'Not Checked In'}
                  {f === 'checked_in' && 'In Daycare'}
                  {f === 'checked_out' && 'Checked Out'}
                  {f === 'alerts_only' && 'Alerts Only'}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto -mx-4 px-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Unable to load today's daycare list. {error}</span>
                </div>
                <button
                  onClick={loadBookings}
                  className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!error && !isLoading && sortedBookings.length === 0 && (
              <div className="text-center py-12">
                <Dog className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-1">No daycare dogs scheduled for today</p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}

            {isLoading && sortedBookings.length === 0 && (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 text-slate-300 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-slate-500">Loading...</p>
              </div>
            )}

            <div className="space-y-2">
              {sortedBookings.map((booking) => (
                <DogRow
                  key={booking.id}
                  booking={booking}
                  onClick={() => handleBookingClick(booking)}
                  showLocation={selectedLocationId === 'ALL'}
                />
              ))}
            </div>
          </div>
        </div>
      </WidgetCard>

      {/* Details Panel */}
      <DogDetailsPanel
        booking={selectedBooking}
        isOpen={isPanelOpen}
        onClose={handlePanelClose}
        onActionComplete={handleActionComplete}
      />
    </>
  );
}

// Individual dog row component
interface DogRowProps {
  booking: DaycareBooking;
  onClick: () => void;
  showLocation: boolean;
}

function DogRow({ booking, onClick, showLocation }: DogRowProps) {
  // Determine if there are any alerts
  const alerts = {
    vaccination: booking.vaccination_status === 'expired' || booking.vaccination_status === 'expiring_soon',
    waiver: booking.waiver_status === 'expired' || booking.waiver_status === 'expiring_soon',
    hold: booking.has_booking_hold || booking.has_payment_hold,
    behaviour: booking.has_behaviour_flag,
    medical: booking.has_medical_flag,
  };

  const hasAnyAlert = Object.values(alerts).some(Boolean);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-slate-200 rounded-lg p-3 hover:border-primary hover:shadow-sm transition-all text-left group"
    >
      <div className="flex items-center gap-3">
        {/* Pet Photo */}
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden">
          {booking.pet_photo_url ? (
            <img src={booking.pet_photo_url} alt={booking.pet_name} className="h-full w-full object-cover" />
          ) : (
            <Dog className="h-6 w-6" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-slate-900 truncate">{booking.pet_name}</h4>
            {hasAnyAlert && (
              <div className="flex items-center gap-1">
                {alerts.hold && <Ban key="hold" className="h-3.5 w-3.5 text-red-500" title="Hold" />}
                {(alerts.vaccination || alerts.waiver) && <FileWarning key="docs" className="h-3.5 w-3.5 text-amber-500" title="Document Alert" />}
                {alerts.behaviour && <AlertTriangle key="behaviour" className="h-3.5 w-3.5 text-orange-500" title="Behaviour Flag" />}
                {alerts.medical && <Activity key="medical" className="h-3.5 w-3.5 text-red-500" title="Medical Flag" />}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate">{booking.household_name}</span>
            {booking.service_type && SERVICE_TYPES[booking.service_type] && (
              <>
                <span>•</span>
                <span className={`${SERVICE_TYPES[booking.service_type].color} font-medium`}>
                  {SERVICE_TYPES[booking.service_type].label}
                </span>
              </>
            )}
            {booking.planned_start_time && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{booking.planned_start_time}</span>
                </span>
              </>
            )}
          </div>
          {showLocation && (
            <div className="text-xs text-slate-400 mt-1">
              {booking.location_name}
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={booking.check_in_status} />
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}

// Status badge component
function StatusBadge({ status }: { status: CheckInStatus }) {
  const config = {
    not_checked_in: { label: 'Not Checked In', className: 'bg-slate-100 text-slate-700' },
    checked_in: { label: 'In Daycare', className: 'bg-blue-100 text-blue-700' },
    checked_out: { label: 'Checked Out', className: 'bg-green-100 text-green-700' },
  };

  // Safety check: default to 'not_checked_in' if status is undefined or invalid
  const statusConfig = config[status as keyof typeof config] || config.not_checked_in;
  const { label, className } = statusConfig;

  return (
    <span className={cn("px-2 py-1 text-xs font-medium rounded-md whitespace-nowrap", className)}>
      {label}
    </span>
  );
}