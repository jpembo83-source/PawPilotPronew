import React, { useEffect } from 'react';
import {
  LogIn, LogOut, ArrowRightLeft, UserCheck, Plus, XCircle,
  Clock, Receipt, AlertCircle, RefreshCw
} from 'lucide-react';
import { useOvernightsStore } from '../store';
import { OvernightEvent } from '../types';

const EVENT_CONFIG: Record<string, { icon: any; label: string; colour: string }> = {
  created: { icon: Plus, label: 'Reservation Created', colour: 'bg-blue-100 text-blue-600' },
  checked_in: { icon: LogIn, label: 'Checked In', colour: 'bg-emerald-100 text-emerald-600' },
  checked_out: { icon: LogOut, label: 'Checked Out', colour: 'bg-slate-100 text-slate-600' },
  transitioned_from_daycare: { icon: ArrowRightLeft, label: 'Transitioned from Daycare', colour: 'bg-purple-100 text-purple-600' },
  transitioned_to_daycare: { icon: ArrowRightLeft, label: 'Transitioned to Daycare', colour: 'bg-indigo-100 text-indigo-600' },
  assigned: { icon: UserCheck, label: 'Assigned', colour: 'bg-teal-100 text-teal-600' },
  carer_assigned: { icon: UserCheck, label: 'Carer Assigned', colour: 'bg-teal-100 text-teal-600' },
  carer_reassigned: { icon: UserCheck, label: 'Carer Reassigned', colour: 'bg-amber-100 text-amber-600' },
  cancelled: { icon: XCircle, label: 'Cancelled', colour: 'bg-red-100 text-red-600' },
  status_changed: { icon: RefreshCw, label: 'Status Changed', colour: 'bg-slate-100 text-slate-600' },
  billing_calculated: { icon: Receipt, label: 'Billing Calculated', colour: 'bg-green-100 text-green-600' },
};

interface EventTimelineProps {
  stayId: string;
}

export function EventTimeline({ stayId }: EventTimelineProps) {
  const { events, fetchEvents, isLoading } = useOvernightsStore();

  useEffect(() => {
    if (stayId) {
      fetchEvents(stayId);
    }
  }, [stayId]);

  if (isLoading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm">No events recorded for this stay</p>
      </div>
    );
  }

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Audit Trail
      </h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

        {sortedEvents.map((event, index) => {
          const config = EVENT_CONFIG[event.eventType] || {
            icon: AlertCircle,
            label: event.eventType,
            colour: 'bg-slate-100 text-slate-600',
          };
          const Icon = config.icon;
          const timestamp = new Date(event.timestamp);

          return (
            <div key={event.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
              <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${config.colour} flex-shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900">{config.label}</span>
                </div>
                <div className="text-xs text-slate-500">
                  <span>{timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="mx-1">at</span>
                  <span>{timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  {event.actorName && (
                    <>
                      <span className="mx-1">by</span>
                      <span className="font-medium text-slate-700">{event.actorName}</span>
                    </>
                  )}
                </div>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-1.5 text-xs text-slate-500 bg-slate-50 rounded px-2 py-1.5 space-y-0.5">
                    {Object.entries(event.metadata).map(([key, value]) => {
                      if (key === 'billingRecalculationRequired' || key === 'vaccinationValid' || key === 'waiverSigned') return null;
                      if (typeof value === 'object') return null;
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                      return (
                        <div key={key}>
                          <span className="text-slate-400">{label}:</span>{' '}
                          <span>{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
