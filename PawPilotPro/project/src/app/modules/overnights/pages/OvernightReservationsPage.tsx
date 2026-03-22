import React, { useState, useEffect, useMemo } from 'react';
import { Moon, Plus, Search, Filter, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useOvernightsStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { CreateReservationModal } from '../components/CreateReservationModal';
import type { OvernightReservation, ReservationStatus } from '../types';

const STATUS_CONFIG: Record<ReservationStatus, { label: string; className: string }> = {
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

export function OvernightReservationsPage() {
  const navigate = useNavigate();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { reservations, fetchReservations, isLoading } = useOvernightsStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const locationId = selectedLocationId === 'ALL' ? undefined : selectedLocationId;

  useEffect(() => {
    fetchReservations(locationId, dateFrom || undefined, dateTo || undefined);
  }, [locationId, dateFrom, dateTo]);

  const filteredReservations = useMemo(() => {
    let result = [...reservations];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.petName?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return result;
  }, [reservations, searchQuery, statusFilter]);

  const handleRefresh = () => {
    fetchReservations(locationId, dateFrom || undefined, dateTo || undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/overnights')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Moon className="h-6 w-6 text-indigo-600" />
              Reservations
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage overnight boarding reservations
            </p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          New Reservation
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by pet name, customer, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="in_stay">In Stay</SelectItem>
              <SelectItem value="checked_out">Checked Out</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
              placeholder="From"
            />
            <span className="text-slate-400">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
              placeholder="To"
            />
          </div>
        </div>
      </Card>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Pet</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Check-in</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Check-out</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nights</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Flags</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Price</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    Loading reservations...
                  </td>
                </tr>
              )}
              {!isLoading && filteredReservations.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <Moon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium">No reservations found</p>
                    <p className="text-xs mt-1">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Create a new reservation to get started'}
                    </p>
                  </td>
                </tr>
              )}
              {!isLoading && filteredReservations.map((reservation) => (
                <ReservationRow key={reservation.id} reservation={reservation} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateReservationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

function ReservationRow({ reservation }: { reservation: OvernightReservation }) {
  const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.booked;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
            {reservation.petName?.charAt(0) || '?'}
          </div>
          <span className="font-medium text-slate-900">{reservation.petName || 'Unknown'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">{reservation.customerName || 'Unknown'}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(reservation.startDate)}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(reservation.endDate)}</td>
      <td className="px-4 py-3 text-slate-600">{reservation.totalNights}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {reservation.requiresMedication && (
            <Badge variant="outline" className="text-rose-600 border-rose-200 text-xs">
              Med
            </Badge>
          )}
          {reservation.hasBehaviourConcerns && (
            <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">
              Beh
            </Badge>
          )}
          {reservation.hasAllergies && (
            <Badge variant="outline" className="text-purple-600 border-purple-200 text-xs">
              Alg
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-900 font-medium">
        &pound;{reservation.totalPrice?.toFixed(2) || '0.00'}
      </td>
    </tr>
  );
}
