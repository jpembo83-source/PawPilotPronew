// Alerts & Flags Widget - Shows document and flag issues requiring attention
import React, { useEffect, useState } from 'react';
import { WidgetCard } from './WidgetCard';
import { Warning, FileDashed, Prohibit, Pulse } from '@phosphor-icons/react';
import { useDaycareStore } from '../../daycare/store';
import { useDashboardStore } from '../store';
import { useCustomerStore } from '../../customers/store';

interface AlertCounts {
  waiverIssues: number;
  behaviourFlags: number;
  medicalFlags: number;
  holds: number;
}

export function AlertsFlagsWidget() {
  const [isLoading, setIsLoading] = useState(true);
  const [alertCounts, setAlertCounts] = useState<AlertCounts>({
    waiverIssues: 0,
    behaviourFlags: 0,
    medicalFlags: 0,
    holds: 0,
  });

  const { bookings, fetchBookings } = useDaycareStore();
  const { selectedLocationId, refreshTrigger } = useDashboardStore();

  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, refreshTrigger]);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      // Fetch today's bookings to check for issues
      const today = new Date().toISOString().split('T')[0];
      await fetchBookings({
        booking_date: today,
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
      });

      // Count issues from bookings
      const allBookings = useDaycareStore.getState().bookings;
      
      const counts: AlertCounts = {
        waiverIssues: 0,
        behaviourFlags: 0,
        medicalFlags: 0,
        holds: 0,
      };

      allBookings.forEach(booking => {
        // Waiver issues (expired or expiring soon)
        if (booking.waiver_status === 'expired' || booking.waiver_status === 'expiring_soon') {
          counts.waiverIssues++;
        }

        // Behaviour flags
        if (booking.has_behaviour_flag) {
          counts.behaviourFlags++;
        }

        // Medical flags
        if (booking.has_medical_flag) {
          counts.medicalFlags++;
        }

        // Holds (booking or payment)
        if (booking.has_booking_hold || booking.has_payment_hold) {
          counts.holds++;
        }
      });

      setAlertCounts(counts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalAlerts = Object.values(alertCounts).reduce((sum, count) => sum + count, 0);

  return (
    <WidgetCard 
      title="Alerts & Flags" 
      icon={Warning}
      description="Issues requiring attention"
    >
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-slate-600 rounded-full mx-auto mb-2"></div>
              <p className="text-xs text-slate-500">Loading alerts...</p>
            </div>
          </div>
        ) : totalAlerts === 0 ? (
          <div className="text-center py-8">
            <Warning className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No alerts today</p>
            <p className="text-xs text-slate-400 mt-1">All clear!</p>
          </div>
        ) : (
          <>
            {/* Waiver Issues */}
            {alertCounts.waiverIssues > 0 && (
              <div key="waiver-issues" className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg p-3 hover:bg-amber-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <FileDashed className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Waiver Issues</p>
                  <p className="text-2xl font-bold text-amber-700">{alertCounts.waiverIssues}</p>
                </div>
              </div>
            )}

            {/* Behaviour Flags */}
            {alertCounts.behaviourFlags > 0 && (
              <div key="behaviour-flags" className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-lg p-3 hover:bg-orange-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Warning className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Behaviour Flags</p>
                  <p className="text-2xl font-bold text-orange-700">{alertCounts.behaviourFlags}</p>
                </div>
              </div>
            )}

            {/* Medical Flags */}
            {alertCounts.medicalFlags > 0 && (
              <div key="medical-flags" className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg p-3 hover:bg-red-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Pulse className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Medical Flags</p>
                  <p className="text-2xl font-bold text-red-700">{alertCounts.medicalFlags}</p>
                </div>
              </div>
            )}

            {/* Holds */}
            {alertCounts.holds > 0 && (
              <div key="account-holds" className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <Prohibit className="h-5 w-5 text-slate-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Account Holds</p>
                  <p className="text-2xl font-bold text-slate-700">{alertCounts.holds}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </WidgetCard>
  );
}