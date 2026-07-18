import React, { useState, useEffect } from 'react';
import { Moon, CalendarBlank, Bed, ClipboardText, UsersThree, Plus, SignIn, SignOut, SquaresFour } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useOvernightsStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { CreateReservationModal } from '../components/CreateReservationModal';

export function OvernightsPage() {
  const navigate = useNavigate();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const {
    reservations,
    tonightsBoarders,
    fetchReservations,
    fetchTonightsBoarders,
    fetchCapacity,
  } = useOvernightsStore();

  const [showCreateModal, setShowCreateModal] = useState(false);

  const selectedLocation = selectedLocationId !== 'ALL'
    ? locations.find(l => l.id === selectedLocationId)
    : locations[0];

  useEffect(() => {
    if (selectedLocation) {
      fetchReservations(selectedLocation.id);
      fetchTonightsBoarders(selectedLocation.id);
      fetchCapacity(selectedLocation.id);
    }
  }, [selectedLocation?.id]);

  if (!selectedLocation) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <Moon className="h-16 w-16 text-slate-300 mb-4" />
        <h2 className="text-lg font-medium text-slate-900">No Location Selected</h2>
        <p>Please select a location to view overnight boarding operations.</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Staying TONIGHT: a stay occupies the nights [startDate, endDate) — a dog
  // departing this morning is not one of tonight's boarders.
  const todayReservations = reservations.filter(r => {
    return r.startDate <= today && r.endDate > today &&
           (r.status === 'checked_in' || r.status === 'in_stay');
  });

  const checkInsToday = reservations.filter(r => {
    return r.startDate === today && (r.status === 'confirmed' || r.status === 'booked');
  });

  const checkOutsToday = reservations.filter(r => {
    return r.endDate === today && (r.status === 'checked_in' || r.status === 'in_stay');
  });

  const unassignedCount = todayReservations.filter(r => !r.assignedCarerUserId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Moon className="h-6 w-6 text-indigo-600" />
            Overnights — {selectedLocation.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage overnight boarding, care logs, and capacity
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          New Reservation
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Bed className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {tonightsBoarders?.totalInStay || 0}
                <span className="text-sm font-normal text-slate-400 ml-1">
                  / {tonightsBoarders?.maxCapacity || 0}
                </span>
              </p>
              <p className="text-xs text-slate-500">Tonight's Boarders</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <CalendarBlank className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{checkInsToday.length}</p>
              <p className="text-xs text-slate-500">Check-ins Today</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <UsersThree className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{checkOutsToday.length}</p>
              <p className="text-xs text-slate-500">Check-outs Today</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
              <ClipboardText className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {tonightsBoarders?.alertsCount || 0}
              </p>
              <p className="text-xs text-slate-500">Special Care Alerts</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate('/overnights/check-in')}>
          <SignIn className="h-4 w-4 text-emerald-600" />
          <div className="text-left">
            <div className="text-sm font-medium">Check In</div>
            <div className="text-xs text-slate-500">{checkInsToday.length} expected</div>
          </div>
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate('/overnights/check-out')}>
          <SignOut className="h-4 w-4 text-blue-600" />
          <div className="text-left">
            <div className="text-sm font-medium">Check Out</div>
            <div className="text-xs text-slate-500">{checkOutsToday.length} departing</div>
          </div>
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate('/overnights/planning')}>
          <SquaresFour className="h-4 w-4 text-purple-600" />
          <div className="text-left">
            <div className="text-sm font-medium">Planning Board</div>
            <div className="text-xs text-slate-500">
              {unassignedCount > 0 ? `${unassignedCount} unassigned` : 'All assigned'}
            </div>
          </div>
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate('/overnights/care-logs')}>
          <ClipboardText className="h-4 w-4 text-orange-600" />
          <div className="text-left">
            <div className="text-sm font-medium">Care Logs</div>
            <div className="text-xs text-slate-500">Nightly records</div>
          </div>
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate('/overnights/capacity')}>
          <Bed className="h-4 w-4 text-indigo-600" />
          <div className="text-left">
            <div className="text-sm font-medium">Capacity</div>
            <div className="text-xs text-slate-500">Manage slots</div>
          </div>
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-600" />
            Tonight's Boarders
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/overnights/reservations')}>
            View All Reservations
          </Button>
        </div>
        <div className="p-6">
          <TonightsBoardersView boarders={tonightsBoarders} />
        </div>
      </div>

      <CreateReservationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          if (selectedLocation) {
            fetchReservations(selectedLocation.id);
            fetchTonightsBoarders(selectedLocation.id);
          }
        }}
      />
    </div>
  );
}

function TonightsBoardersView({ boarders }: { boarders: any }) {
  const navigate = useNavigate();

  if (!boarders || !boarders.boarders || boarders.boarders.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Moon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p>No boarders staying tonight</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {boarders.boarders.map((boarder: any) => (
        <div
          key={boarder.reservationId}
          className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors cursor-pointer"
          onClick={() => navigate(`/overnights/reservations`)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {boarder.petName?.charAt(0) || '?'}
                </div>
                <h4 className="font-medium text-slate-900">{boarder.petName}</h4>
                <Badge variant="outline" className="text-xs">
                  {boarder.sleepingAreaName || 'Unassigned'}
                </Badge>
                {boarder.assignedCarerName && (
                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                    Carer: {boarder.assignedCarerName}
                  </Badge>
                )}
                {boarder.careLogCompleted && (
                  <Badge className="text-xs bg-emerald-500">
                    Log Complete
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600 ml-11">{boarder.customerName}</p>
              {boarder.specialNotes && (
                <p className="text-xs text-slate-500 mt-2 ml-11">{boarder.specialNotes}</p>
              )}
              <div className="flex gap-2 mt-2 ml-11">
                {boarder.requiresMedication && (
                  <Badge variant="outline" className="text-xs text-rose-600 border-rose-200">
                    Medication Required
                  </Badge>
                )}
                {boarder.hasBehaviourConcerns && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                    Behaviour Note
                  </Badge>
                )}
                {boarder.hasAllergies && (
                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                    Allergies
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
