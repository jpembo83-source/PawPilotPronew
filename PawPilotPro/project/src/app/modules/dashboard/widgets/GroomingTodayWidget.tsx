// Today's Grooming Widget - Shows grooming appointments for today
import React, { useEffect, useState } from 'react';
import { WidgetCard } from './WidgetCard';
import { Scissors, Clock, ArrowClockwise, CheckCircle, Warning, CaretRight } from '@phosphor-icons/react';
import { useDashboardStore } from '../store';
import { useGroomingStore } from '../../grooming/store';
import { useNavigate } from 'react-router';
import { cn } from '../../../components/ui/utils';
import type { GroomingAppointment } from '../../grooming/types';

export function GroomingTodayWidget() {
  const navigate = useNavigate();
  const { selectedLocationId, refreshTrigger } = useDashboardStore();
  const { appointments, fetchAppointments, isLoading, error } = useGroomingStore();
  const [localLoading, setLocalLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadAppointments();
  }, [selectedLocationId, refreshTrigger]);

  const loadAppointments = async () => {
    setLocalLoading(true);
    try {
      await fetchAppointments({
        date: today,
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
      });
    } catch (err) {
      console.error('Failed to load grooming appointments:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  // Filter to today's appointments
  const todaysAppointments = appointments.filter(apt => 
    apt.appointment_date === today
  );

  // Sort by time
  const sortedAppointments = [...todaysAppointments].sort((a, b) => {
    if (a.start_time && b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return 0;
  });

  // Count by status
  const statusCounts = {
    scheduled: todaysAppointments.filter(a => a.status === 'scheduled').length,
    in_progress: todaysAppointments.filter(a => a.status === 'in_progress').length,
    completed: todaysAppointments.filter(a => a.status === 'completed').length,
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      scheduled: { label: 'Scheduled', className: 'bg-slate-100 text-slate-700' },
      in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
      completed: { label: 'Done', className: 'bg-green-100 text-green-700' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
      no_show: { label: 'No Show', className: 'bg-amber-100 text-amber-700' },
    };
    const { label, className } = config[status] || config.scheduled;
    return (
      <span className={cn("px-2 py-0.5 text-xs font-medium rounded", className)}>
        {label}
      </span>
    );
  };

  return (
    <WidgetCard 
      title="Today's Grooming" 
      icon={Scissors}
      description="Grooming appointments"
    >
      <div className="flex flex-col h-full">
        {/* Stats header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              <span className="font-semibold text-slate-700">{todaysAppointments.length}</span> total
            </span>
            {statusCounts.in_progress > 0 && (
              <span className="text-blue-600">
                <span className="font-semibold">{statusCounts.in_progress}</span> in progress
              </span>
            )}
            <span className="text-green-600">
              <span className="font-semibold">{statusCounts.completed}</span> done
            </span>
          </div>
          <button
            onClick={loadAppointments}
            disabled={localLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            title="Refresh"
          >
            <ArrowClockwise className={cn("h-4 w-4", localLoading && "animate-spin")} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto -mx-4 px-4">
          {localLoading && sortedAppointments.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <ArrowClockwise className="h-6 w-6 text-slate-300 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <Warning className="h-4 w-4" />
                <span>Failed to load appointments</span>
              </div>
            </div>
          ) : sortedAppointments.length === 0 ? (
            <div className="text-center py-8">
              <Scissors className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No grooming appointments today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAppointments.slice(0, 6).map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => navigate(`/grooming/appointments/${apt.id}`)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-sm transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    {/* Pet avatar */}
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold flex-shrink-0">
                      {apt.pet_name?.charAt(0) || '?'}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-slate-900 truncate">{apt.pet_name}</span>
                        {getStatusBadge(apt.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {apt.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {apt.start_time}
                          </span>
                        )}
                        {apt.service_name && (
                          <>
                            <span>•</span>
                            <span className="truncate">{apt.service_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <CaretRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                  </div>
                </button>
              ))}

              {sortedAppointments.length > 6 && (
                <button
                  onClick={() => navigate('/grooming')}
                  className="w-full text-center py-2 text-sm text-primary hover:underline"
                >
                  View all {sortedAppointments.length} appointments →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer link */}
        {sortedAppointments.length > 0 && (
          <div className="pt-3 border-t border-slate-100 mt-3">
            <button
              onClick={() => navigate('/grooming')}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-slate-900 py-2"
            >
              <span>Manage Grooming</span>
              <CaretRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
