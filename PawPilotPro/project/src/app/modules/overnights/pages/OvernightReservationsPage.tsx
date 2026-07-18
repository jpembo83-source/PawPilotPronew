import React, { useState, useEffect, useMemo } from 'react';
import { Moon, Plus, MagnifyingGlass, Funnel, CalendarBlank, ArrowLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useOvernightsStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { formatCurrency } from '../../../utils/currency';
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
import { ReservationDetailDialog } from '../components/ReservationDetailDialog';
import { STATUS_CONFIG } from '../constants';
import type { OvernightReservation } from '../types';

import { useBackNavigation } from '../../../components/BackButton';

export function OvernightReservationsPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/overnights');
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { reservations, fetchReservations, isLoading } = useOvernightsStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailReservation, setDetailReservation] = useState<OvernightReservation | null>(null);
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Moon className="h-6 w-6 text-primary" />
              Reservations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
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
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary-foreground" />
            <Input
              placeholder="Search by pet name, customer, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Funnel className="h-4 w-4 mr-2 text-tertiary-foreground" />
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
            <CalendarBlank className="h-4 w-4 text-tertiary-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
              placeholder="From"
            />
            <span className="text-tertiary-foreground">to</span>
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

      {/* Mobile: card list — the 8-column table is unusable on a phone. */}
      <div className="md:hidden space-y-3">
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">Loading reservations...</div>
        )}
        {!isLoading && filteredReservations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Moon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">No reservations found</p>
            <p className="text-sm mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create a new reservation to get started'}
            </p>
          </div>
        )}
        {!isLoading && filteredReservations.map((reservation) => (
          <ReservationCard
            key={reservation.id}
            reservation={reservation}
            onClick={() => setDetailReservation(reservation)}
          />
        ))}
      </div>

      <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pet</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check-in</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check-out</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nights</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flags</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Price</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Loading reservations...
                  </td>
                </tr>
              )}
              {!isLoading && filteredReservations.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Moon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="font-medium">No reservations found</p>
                    <p className="text-sm mt-1">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Create a new reservation to get started'}
                    </p>
                  </td>
                </tr>
              )}
              {!isLoading && filteredReservations.map((reservation) => (
                <ReservationRow
                  key={reservation.id}
                  reservation={reservation}
                  onClick={() => setDetailReservation(reservation)}
                />
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

      <ReservationDetailDialog
        reservation={detailReservation}
        open={detailReservation !== null}
        onOpenChange={(open) => { if (!open) setDetailReservation(null); }}
        onChanged={handleRefresh}
      />
    </div>
  );
}

function ReservationCard({ reservation, onClick }: { reservation: OvernightReservation; onClick: () => void }) {
  const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.booked;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 space-y-2 cursor-pointer hover:border-ring/40 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary-tint flex items-center justify-center text-primary-strong font-bold text-sm shrink-0">
            {reservation.petName?.charAt(0) || '?'}
          </div>
          <span className="font-medium text-foreground truncate">{reservation.petName || 'Unknown'}</span>
        </div>
        <Badge variant="outline" className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{reservation.customerName || 'Unknown'}</p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatDate(reservation.startDate)} &rarr; {formatDate(reservation.endDate)}
          {' '}&middot; {reservation.totalNights} {reservation.totalNights === 1 ? 'night' : 'nights'}
        </span>
        <span className="font-medium text-foreground">
          {formatCurrency(reservation.totalPrice ?? 0, reservation.currency)}
        </span>
      </div>
      {(reservation.requiresMedication || reservation.hasBehaviourConcerns || reservation.hasAllergies) && (
        <div className="flex gap-1 flex-wrap">
          {reservation.requiresMedication && (
            <Badge variant="outline" className="text-rose-600 border-rose-200 text-sm">Medication</Badge>
          )}
          {reservation.hasBehaviourConcerns && (
            <Badge variant="outline" className="text-amber-600 border-amber-200 text-sm">Behaviour</Badge>
          )}
          {reservation.hasAllergies && (
            <Badge variant="outline" className="text-purple-600 border-purple-200 text-sm">Allergies</Badge>
          )}
        </div>
      )}
    </div>
  );
}

function ReservationRow({ reservation, onClick }: { reservation: OvernightReservation; onClick: () => void }) {
  const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.booked;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <tr className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={onClick}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary-tint flex items-center justify-center text-primary font-bold text-sm">
            {reservation.petName?.charAt(0) || '?'}
          </div>
          <span className="font-medium text-foreground">{reservation.petName || 'Unknown'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{reservation.customerName || 'Unknown'}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(reservation.startDate)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(reservation.endDate)}</td>
      <td className="px-4 py-3 text-muted-foreground">{reservation.totalNights}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {reservation.requiresMedication && (
            <Badge variant="outline" className="text-rose-600 border-rose-200 text-sm">
              Med
            </Badge>
          )}
          {reservation.hasBehaviourConcerns && (
            <Badge variant="outline" className="text-amber-600 border-amber-200 text-sm">
              Beh
            </Badge>
          )}
          {reservation.hasAllergies && (
            <Badge variant="outline" className="text-purple-600 border-purple-200 text-sm">
              Alg
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-foreground font-medium">
        {formatCurrency(reservation.totalPrice ?? 0, reservation.currency)}
      </td>
    </tr>
  );
}
