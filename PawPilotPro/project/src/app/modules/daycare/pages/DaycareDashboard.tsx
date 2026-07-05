// Daycare Dashboard - MDC Operations Centre
// Operational home for daycare with today's overview and quick actions

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  CalendarBlank,
  UsersThree,
  Warning,
  Clock,
  TrendUp,
  SignIn,
  SignOut,
  Plus,
  XCircle,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

export function DaycareDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { stats, isLoading, error, fetchStats, clearError } = useDaycareStore();

  const [currentTime, setCurrentTime] = useState(new Date());
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [selectedLocationId]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);

  const loadData = async () => {
    try {
      await fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today);
    } catch (err) {
      // Error handled by store
    }
  };

  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager' || user?.role === 'staff';

  // Derived values
  const checkedIn = stats?.checked_in_count || 0;
  const availableSlots = stats?.available_slots || 0;
  const utilisation = stats?.capacity_utilisation ? Math.round(stats.capacity_utilisation) : 0;
  const totalBookings = stats?.total_bookings || 0;
  const noShows = stats?.no_shows || 0;
  const cancellations = stats?.cancellations || 0;
  const noShowPct = totalBookings > 0 ? ((noShows / totalBookings) * 100).toFixed(1) : '0';
  const cancellationPct = totalBookings > 0 ? ((cancellations / totalBookings) * 100).toFixed(1) : '0';
  const completionRate = totalBookings > 0
    ? (((totalBookings - cancellations - noShows) / totalBookings) * 100).toFixed(1)
    : '0';

  const hasAlerts = stats && (
    stats.waiver_alerts > 0 ||
    stats.hold_alerts > 0 ||
    stats.behaviour_flags > 0 ||
    stats.medical_flags > 0
  );

  const formattedDate = currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const formattedTime = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-[#F4F3EF] min-h-full">

      {/* ── Section 1: Page Header ── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1916]">Daycare</h1>
          <p className="text-sm text-[#6B6762] mt-0.5">
            {formattedDate} · {formattedTime}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="bg-primary text-white rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm hover:opacity-90 transition-colors"
            onClick={() => navigate('/daycare/check-in')}
          >
            <SignIn className="h-4 w-4" />
            Check In
          </button>
          <button
            className="rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm border border-[#E2DED8] bg-white text-[#1C1916] hover:border-primary transition-colors"
            onClick={() => navigate('/daycare/check-out')}
          >
            <SignOut className="h-4 w-4" />
            Check Out
          </button>
        </div>
      </div>

      {/* ── Section 2: Capacity Hero Widget ── */}
      <div className="bg-white rounded-2xl border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-xs uppercase tracking-wide text-tertiary-foreground font-medium">Capacity Today</span>
            <div className="text-5xl font-bold text-[#1C1916] mt-1 leading-none">{utilisation}%</div>
            <p className="text-sm text-[#6B6762] mt-2">
              {checkedIn} dog{checkedIn !== 1 ? 's' : ''} in · {availableSlots} spot{availableSlots !== 1 ? 's' : ''} remaining
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-primary-tint">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(utilisation, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center pl-4 border-l border-[#E2DED8] shrink-0">
            <div className="text-3xl font-bold text-primary">{checkedIn}</div>
            <div className="text-xs text-[#6B6762] mt-0.5 whitespace-nowrap">Currently in</div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Today's Bookings */}
        <div
          className="bg-white rounded-2xl p-4 border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}`)}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-tertiary-foreground font-medium">Today's Bookings</span>
              <CalendarBlank className="h-4 w-4 text-tertiary-foreground" />
            </div>
            <div className="text-3xl font-bold text-[#1C1916]">{totalBookings}</div>
            <div className="text-xs text-[#6B6762]">{stats?.confirmed_bookings || 0} confirmed</div>
          </div>
        </div>

        {/* Expected Arrivals */}
        <div
          className="bg-white rounded-2xl p-4 border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&check_in_status=not_checked_in`)}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-tertiary-foreground font-medium">Expected Arrivals</span>
              <Clock className="h-4 w-4 text-tertiary-foreground" />
            </div>
            <div className="text-3xl font-bold text-[#B45309]">{stats?.expected_arrivals_2h || 0}</div>
            <div className="text-xs text-[#6B6762]">Next 2 hours</div>
          </div>
        </div>

        {/* Expected Pickups */}
        <div
          className="bg-white rounded-2xl p-4 border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&check_in_status=checked_in`)}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-tertiary-foreground font-medium">Expected Pickups</span>
              <Clock className="h-4 w-4 text-tertiary-foreground" />
            </div>
            <div className="text-3xl font-bold text-primary">{stats?.expected_pickups_2h || 0}</div>
            <div className="text-xs text-[#6B6762]">Next 2 hours</div>
          </div>
        </div>

        {/* No Shows */}
        <div
          className="bg-white rounded-2xl p-4 border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&status=no_show`)}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-tertiary-foreground font-medium">No Shows</span>
              <XCircle className="h-4 w-4 text-tertiary-foreground" />
            </div>
            <div className="text-3xl font-bold text-[#1C1916]">{noShows}</div>
            <div className="text-xs text-[#6B6762]">{noShowPct}% of bookings</div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Alerts (conditional) ── */}
      {hasAlerts && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Warning className="h-5 w-5 text-[#B45309] shrink-0" />
            <span className="text-sm font-semibold text-[#92400E]">Attention Required</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {stats!.waiver_alerts > 0 && (
              <div className="bg-white rounded-xl px-3 py-1.5 border border-[#FCD34D] flex items-center gap-1.5">
                <Warning className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs text-[#1C1916]">{stats!.waiver_alerts} Waiver {stats!.waiver_alerts === 1 ? 'Issue' : 'Issues'}</span>
              </div>
            )}
            {stats!.hold_alerts > 0 && (
              <div className="bg-white rounded-xl px-3 py-1.5 border border-[#FCD34D] flex items-center gap-1.5">
                <Warning className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-[#1C1916]">{stats!.hold_alerts} Account {stats!.hold_alerts === 1 ? 'Hold' : 'Holds'}</span>
              </div>
            )}
            {stats!.behaviour_flags > 0 && (
              <div className="bg-white rounded-xl px-3 py-1.5 border border-[#FCD34D] flex items-center gap-1.5">
                <Warning className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-[#1C1916]">{stats!.behaviour_flags} Behaviour {stats!.behaviour_flags === 1 ? 'Flag' : 'Flags'}</span>
              </div>
            )}
            {stats!.medical_flags > 0 && (
              <div className="bg-white rounded-xl px-3 py-1.5 border border-[#FCD34D] flex items-center gap-1.5">
                <Warning className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-[#1C1916]">{stats!.medical_flags} Medical {stats!.medical_flags === 1 ? 'Flag' : 'Flags'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 5: Quick Actions ── */}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-[#6B6762] uppercase tracking-wide">Quick Actions</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            className="bg-white rounded-2xl border border-[#E2DED8] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary hover:bg-primary-tint transition-colors active:scale-[0.98]"
            onClick={() => navigate('/daycare/check-in')}
          >
            <SignIn className="h-6 w-6 text-primary" />
            <span className="font-medium text-sm text-[#1C1916]">Check In</span>
          </button>

          <button
            className="bg-white rounded-2xl border border-[#E2DED8] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary hover:bg-primary-tint transition-colors active:scale-[0.98]"
            onClick={() => navigate('/daycare/check-out')}
          >
            <SignOut className="h-6 w-6 text-primary" />
            <span className="font-medium text-sm text-[#1C1916]">Check Out</span>
          </button>

          <button
            className="bg-white rounded-2xl border border-[#E2DED8] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary hover:bg-primary-tint transition-colors active:scale-[0.98]"
            onClick={() => navigate('/daycare/bookings?action=create')}
          >
            <Plus className="h-6 w-6 text-primary" />
            <span className="font-medium text-sm text-[#1C1916]">New Booking</span>
          </button>

          <button
            className="bg-white rounded-2xl border border-[#E2DED8] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary hover:bg-primary-tint transition-colors active:scale-[0.98]"
            onClick={() => navigate('/daycare/attendance')}
          >
            <UsersThree className="h-6 w-6 text-primary" />
            <span className="font-medium text-sm text-[#1C1916]">Attendance</span>
          </button>
        </div>
      </div>

      {/* ── Section 6: Performance Metrics ── */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div
            className="bg-white rounded-2xl border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] p-4 cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&status=no_show`)}
          >
            <div className="text-xs text-tertiary-foreground font-medium mb-2">No Shows</div>
            <div className="text-2xl font-bold text-[#1C1916]">{noShows}</div>
            <div className="text-xs text-[#6B6762] mt-1">{noShowPct}% of bookings</div>
          </div>

          <div
            className="bg-white rounded-2xl border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] p-4 cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&status=cancelled`)}
          >
            <div className="text-xs text-tertiary-foreground font-medium mb-2">Cancellations</div>
            <div className="text-2xl font-bold text-[#1C1916]">{cancellations}</div>
            <div className="text-xs text-[#6B6762] mt-1">{cancellationPct}% of bookings</div>
          </div>

          <div
            className="bg-white rounded-2xl border border-[#E2DED8] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] p-4 cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}`)}
          >
            <div className="text-xs text-tertiary-foreground font-medium mb-2">Completion Rate</div>
            <div className="text-2xl font-bold text-primary">{completionRate}%</div>
            <div className="text-xs text-[#6B6762] mt-1">Successful bookings</div>
          </div>
        </div>
      )}

    </div>
  );
}
