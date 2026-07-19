import React, { useEffect } from 'react';
import {
  SignIn, SignOut, ArrowsLeftRight, UserCheck, Plus, XCircle,
  Clock, Receipt, Warning, ArrowClockwise
} from '@phosphor-icons/react';
import { useOvernightsStore } from '../store';
import { OvernightEvent } from '../types';

const EVENT_CONFIG: Record<string, { icon: any; label: string; colour: string }> = {
  created: { icon: Plus, label: 'Reservation Created', colour: 'bg-blue-100 text-blue-600' },
  checked_in: { icon: SignIn, label: 'Checked In', colour: 'bg-emerald-100 text-emerald-600' },
  checked_out: { icon: SignOut, label: 'Checked Out', colour: 'bg-muted text-muted-foreground' },
  transitioned_from_daycare: { icon: ArrowsLeftRight, label: 'Transitioned from Daycare', colour: 'bg-purple-100 text-purple-600' },
  transitioned_to_daycare: { icon: ArrowsLeftRight, label: 'Transitioned to Daycare', colour: 'bg-primary-tint text-primary' },
  assigned: { icon: UserCheck, label: 'Assigned', colour: 'bg-teal-100 text-teal-600' },
  carer_assigned: { icon: UserCheck, label: 'Carer Assigned', colour: 'bg-teal-100 text-teal-600' },
  carer_reassigned: { icon: UserCheck, label: 'Carer Reassigned', colour: 'bg-amber-100 text-amber-600' },
  cancelled: { icon: XCircle, label: 'Cancelled', colour: 'bg-red-100 text-red-600' },
  status_changed: { icon: ArrowClockwise, label: 'Status Changed', colour: 'bg-muted text-muted-foreground' },
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
        <ArrowClockwise className="h-5 w-5 text-muted-foreground/40 animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm">No events recorded for this stay</p>
      </div>
    );
  }

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Audit Trail
      </h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-muted" />

        {sortedEvents.map((event, index) => {
          const config = EVENT_CONFIG[event.eventType] || {
            icon: Warning,
            label: event.eventType,
            colour: 'bg-muted text-muted-foreground',
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
                  <span className="text-sm font-medium text-foreground">{config.label}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span>{timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="mx-1">at</span>
                  <span>{timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  {event.actorName && (
                    <>
                      <span className="mx-1">by</span>
                      <span className="font-medium text-foreground">{event.actorName}</span>
                    </>
                  )}
                </div>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-1.5 text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1.5 space-y-0.5">
                    {Object.entries(event.metadata).map(([key, value]) => {
                      if (key === 'billingRecalculationRequired' || key === 'vaccinationValid' || key === 'waiverSigned') return null;
                      if (typeof value === 'object') return null;
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                      return (
                        <div key={key}>
                          <span className="text-tertiary-foreground">{label}:</span>{' '}
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
