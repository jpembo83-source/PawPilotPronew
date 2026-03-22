// Today's Dogs Widget - Simple check-in/out management
import React, { useState, useEffect } from 'react';
import { WidgetCard } from './WidgetCard';
import { Dog, LogOut } from 'lucide-react';
import { useDaycareStore } from '../../daycare/store';
import { useDashboardStore } from '../store';
import { cn } from '../../../components/ui/utils';
import type { DaycareBooking } from '../../daycare/types';

export function TodaysDogsWidget() {
  const { bookings, fetchBookings, checkOut, isLoading } = useDaycareStore();
  const { selectedLocationId } = useDashboardStore();

  const today = new Date().toISOString().split('T')[0];

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
      console.error('Failed to load bookings:', err);
    }
  };

  // Get dogs currently on site (checked in but not checked out)
  const dogsOnSite = bookings.filter(b => b.check_in_status === 'checked_in');

  const handleCheckOut = async (booking: DaycareBooking) => {
    try {
      await checkOut(booking.id);
      // Refresh the bookings list to update the widget
      await loadBookings();
    } catch (err) {
      console.error('Failed to check out:', err);
    }
  };

  return (
    <WidgetCard title="Today's Dogs" icon={Dog}>
      <div className="flex flex-col h-full">
        <p className="text-sm text-slate-500 mb-4">
          Manage check-ins and check-outs
        </p>

        <div className="mb-4">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium">
            {dogsOnSite.length} on site
          </div>
        </div>

        <div className="mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ON SITE</h3>
        </div>

        <div className="flex-1 overflow-y-auto -mx-4 px-4 space-y-3">
          {dogsOnSite.length === 0 && (
            <div className="text-center py-8">
              <Dog className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No dogs currently on site</p>
            </div>
          )}

          {dogsOnSite.map((booking) => (
            <div key={booking.id} className="bg-slate-50 rounded-lg p-4 flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg">
                  {booking.pet_name.charAt(0)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-900 mb-0.5">{booking.pet_name}</h4>
                <p className="text-sm text-slate-500">
                  {booking.service_name || 'Daycare (Full Day)'}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                  Checked In
                </span>
                <button
                  onClick={() => handleCheckOut(booking)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Out
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}