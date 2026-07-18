import type { ReservationStatus } from './types';

/** Status badge labels/tints — single source for every overnights surface. */
export const STATUS_CONFIG: Record<ReservationStatus, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  checked_in: { label: 'Checked In', className: 'bg-green-100 text-green-700 border-green-200' },
  in_stay: { label: 'In Stay', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  transitioning_to_daycare: { label: 'To Daycare', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  transitioning_from_daycare: { label: 'From Daycare', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  checked_out: { label: 'Checked Out', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
  no_show: { label: 'No Show', className: 'bg-rose-100 text-rose-700 border-rose-200' },
};

/** Statuses a reservation can be cancelled from (pre-arrival only). */
export const CANCELLABLE_STATUSES: ReservationStatus[] = ['booked', 'confirmed'];
