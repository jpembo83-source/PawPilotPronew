// Daycare Bookings - MDC Operations Centre

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import {
  CalendarBlank,
  MagnifyingGlass,
  Plus,
  Warning,
  X,
  Clock,
  Dog,
  Medal,
  CreditCard,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { DaycareBooking } from '../types';
import { CreateBookingDialog } from '../components/CreateBookingDialog';

function StatusBadge({ booking }: { booking: DaycareBooking }) {
  if (booking.booking_status === 'cancelled') {
    return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Cancelled</Badge>;
  }
  if (booking.booking_status === 'no_show') {
    return <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">No Show</Badge>;
  }
  if (booking.booking_status === 'completed') {
    return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Completed</Badge>;
  }
  if (booking.check_in_status === 'checked_in') {
    return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Checked In</Badge>;
  }
  if (booking.check_in_status === 'checked_out') {
    return <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Checked Out</Badge>;
  }
  return <Badge className="bg-primary-tint text-primary border-0 text-xs">Confirmed</Badge>;
}

export function DaycareBookings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { bookings, isLoading, fetchBookings, cancelBooking } = useDaycareStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<DaycareBooking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const filterParam = searchParams.get('filter') || 'all';
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const statusParam = searchParams.get('status');
  const checkInStatusParam = searchParams.get('check_in_status');

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowCreateDialog(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [selectedLocationId, filterParam, dateParam, statusParam, checkInStatusParam]);

  const loadBookings = async () => {
    try {
      const filters: any = {
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
      };
      if (dateParam) filters.date = dateParam;
      if (filterParam === 'upcoming') filters.upcoming = true;
      if (statusParam) filters.booking_status = statusParam;
      if (checkInStatusParam) filters.check_in_status = checkInStatusParam;
      await fetchBookings(filters);
    } catch {
      // Error handled by store
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return b.pet_name.toLowerCase().includes(q) || b.household_name.toLowerCase().includes(q);
  });

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    try {
      await cancelBooking(selectedBooking.id, cancelReason);
      toast.success(`Booking for ${selectedBooking.pet_name} cancelled`);
      setShowCancelDialog(false);
      setSelectedBooking(null);
      setCancelReason('');
      await loadBookings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    }
  };

  const canCreate = !!user;
  const canCancel = user?.role === 'admin' || user?.role === 'manager';

  const tabs = [
    { key: 'all',      label: 'All' },
    { key: 'today',    label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
  ];

  return (
    <div className="p-5 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            style={{ backgroundColor: 'var(--primary)' }}
            className="text-white hover:opacity-90 gap-1.5"
          >
            <Plus size={16} weight="bold" />
            New Booking
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search pet or household…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Input
          type="date"
          value={dateParam}
          onChange={(e) => {
            searchParams.set('date', e.target.value);
            setSearchParams(searchParams);
          }}
          className="w-40 h-9 text-sm"
        />
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              searchParams.set('filter', tab.key);
              setSearchParams(searchParams);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filterParam === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Booking list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <CalendarBlank size={28} className="text-slate-400" />
          </div>
          <p className="font-medium text-slate-600">No bookings found</p>
          <p className="text-sm text-slate-400 mt-1">
            {searchQuery ? 'Try a different search term' : 'Create a new booking to get started'}
          </p>
          {canCreate && !searchQuery && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus size={14} className="mr-1" /> New Booking
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center gap-3 p-3 bg-white border rounded-xl hover:border-slate-300 transition-colors"
            >
              {/* Avatar */}
              {booking.pet_photo_url ? (
                <img
                  src={booking.pet_photo_url}
                  alt={booking.pet_name}
                  className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-primary-tint flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">{booking.pet_name[0]}</span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900 text-sm">{booking.pet_name}</span>
                  {booking.has_behaviour_flag && (
                    <Badge className="bg-amber-100 text-amber-700 border-0 text-xs px-1.5 py-0">
                      <Warning size={10} className="mr-0.5" />Behaviour
                    </Badge>
                  )}
                  {booking.has_medical_flag && (
                    <Badge className="bg-red-100 text-red-700 border-0 text-xs px-1.5 py-0">
                      <Warning size={10} className="mr-0.5" />Medical
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500">{booking.household_name}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <CalendarBlank size={11} />
                    {new Date(booking.booking_date).toLocaleDateString('en-GB')}
                  </span>
                  {booking.planned_start_time && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={11} />
                      {booking.planned_start_time}
                    </span>
                  )}
                </div>
              </div>

              {/* Status + actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {booking.service_type === 'membership' ? (
                  <Badge className="bg-primary-tint text-primary border-0 text-xs gap-1">
                    <Medal size={10} />Member
                  </Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-500 border-0 text-xs gap-1">
                    <CreditCard size={10} />PAYG
                  </Badge>
                )}
                <StatusBadge booking={booking} />
                {canCancel && booking.booking_status === 'confirmed' && (
                  <button
                    onClick={() => { setSelectedBooking(booking); setShowCancelDialog(true); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Cancel booking"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create booking dialog */}
      <CreateBookingDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          setShowCreateDialog(false);
          loadBookings();
        }}
      />

      {/* Cancel confirmation dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Cancel the booking for <strong>{selectedBooking?.pet_name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-slate-700">Reason</label>
            <Input
              placeholder="Reason for cancellation…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={isLoading || !cancelReason.trim()}
            >
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
