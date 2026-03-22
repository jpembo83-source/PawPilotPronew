import React from 'react';
import { X, Dog, Scissors, Moon, Car, Clock, MapPin, User, Home, AlertTriangle, ExternalLink } from 'lucide-react';
import { CalendarEvent, SERVICE_COLOURS, SERVICE_LABELS } from '../types';

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  onClose: () => void;
  locationName?: string;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  daycare: Dog,
  grooming: Scissors,
  overnights: Moon,
  transport: Car,
};

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const timePart = dateStr.split('T')[1];
    if (timePart) return timePart.substring(0, 5);
    return '';
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split('T')[0];
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    completed: 'bg-slate-100 text-slate-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-amber-100 text-amber-800',
    checked_in: 'bg-blue-100 text-blue-800',
    checked_out: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-indigo-100 text-indigo-800',
    scheduled: 'bg-sky-100 text-sky-800',
    in_transit: 'bg-orange-100 text-orange-800',
    requested: 'bg-yellow-100 text-yellow-800',
  };
  return map[status] || 'bg-slate-100 text-slate-700';
}

export function EventDetailPanel({ event, onClose, locationName }: EventDetailPanelProps) {
  if (!event) return null;

  const colours = SERVICE_COLOURS[event.source_type];
  const Icon = SOURCE_ICONS[event.source_type] || Dog;

  const viewRecordPath = (() => {
    switch (event.source_type) {
      case 'daycare': return `/daycare`;
      case 'grooming': return `/grooming`;
      case 'overnights': return `/overnights`;
      case 'transport': return `/transport`;
      default: return '/';
    }
  })();

  const householdPath = event.household_id ? `/customers/${event.household_id}` : null;
  const petPath = event.pet_id ? `/customers/pets/${event.pet_id}` : null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
      <div className={`flex items-center justify-between p-4 border-b ${colours.bg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${colours.text}`} />
          <span className={`text-sm font-semibold ${colours.text}`}>{SERVICE_LABELS[event.source_type]}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/50 transition-colors">
          <X className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{event.pet_name || event.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{event.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(event.status)}`}>
            {event.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
          {event.flags.map(flag => (
            <span key={flag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="h-3 w-3 mr-1" />{flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-700">{formatDate(event.start_at)}</p>
              <p className="text-sm text-slate-500">{formatTime(event.start_at)} — {formatTime(event.end_at)}</p>
            </div>
          </div>

          {event.household_name && (
            <div className="flex items-start gap-3">
              <Home className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">{event.household_name}</p>
                <p className="text-xs text-slate-400">Household</p>
              </div>
            </div>
          )}

          {locationName && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">{locationName}</p>
                <p className="text-xs text-slate-400">Location</p>
              </div>
            </div>
          )}

          {event.assigned_staff && (
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">{event.assigned_staff}</p>
                <p className="text-xs text-slate-400">
                  {event.source_type === 'grooming' ? 'Groomer' :
                   event.source_type === 'transport' ? 'Driver' :
                   event.source_type === 'overnights' ? 'Overnight Carer' : 'Staff'}
                </p>
              </div>
            </div>
          )}

          {event.direction && (
            <div className="flex items-start gap-3">
              <Car className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {event.direction === 'pickup' ? 'Pick-up' : 'Drop-off'}
                </p>
                <p className="text-xs text-slate-400">Direction</p>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-2">
          <a
            href={viewRecordPath}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View {SERVICE_LABELS[event.source_type]} Record
          </a>
          {petPath && (
            <a
              href={petPath}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Dog className="h-4 w-4" />
              View Pet Profile
            </a>
          )}
          {householdPath && (
            <a
              href={householdPath}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Home className="h-4 w-4" />
              View Household
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
