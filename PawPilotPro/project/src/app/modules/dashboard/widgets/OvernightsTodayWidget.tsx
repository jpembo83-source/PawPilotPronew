import React, { useEffect, useState, useMemo } from 'react';
import { WidgetCard } from './WidgetCard';
import { Moon, ArrowClockwise, Warning, CaretRight, Pill, Warning, Heart, CheckCircle, UserCheck, UserMinus } from '@phosphor-icons/react';
import { useDashboardStore } from '../store';
import { useOvernightsStore } from '../../overnights/store';
import { useNavigate } from 'react-router';
import { cn } from '../../../components/ui/utils';

export function OvernightsTodayWidget() {
  const navigate = useNavigate();
  const { selectedLocationId, refreshTrigger } = useDashboardStore();
  const { tonightsBoarders, fetchTonightsBoarders, reservations, fetchReservations, carers, fetchCarers, isLoading, error } = useOvernightsStore();
  const [localLoading, setLocalLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const isAllLocations = !selectedLocationId || selectedLocationId === 'ALL';

  useEffect(() => {
    loadData();
  }, [selectedLocationId, refreshTrigger]);

  const loadData = async () => {
    setLocalLoading(true);
    try {
      if (!isAllLocations) {
        await Promise.all([
          fetchTonightsBoarders(selectedLocationId, today),
          fetchReservations(selectedLocationId, today, today),
          fetchCarers(selectedLocationId, today),
        ]);
      } else {
        await fetchReservations(undefined, today, today);
      }
    } catch (err) {
      console.error('Failed to load overnight data:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const boarders = tonightsBoarders?.boarders || [];
  const totalInStay = tonightsBoarders?.totalInStay || 0;
  const maxCapacity = tonightsBoarders?.maxCapacity || 0;

  const arrivingToday = reservations.filter(r =>
    r.startDate === today &&
    (r.status === 'confirmed' || r.status === 'booked')
  ).length;

  const departingToday = reservations.filter(r =>
    r.endDate === today &&
    (r.status === 'in_stay' || r.status === 'checked_in')
  ).length;

  const capacityPercent = maxCapacity > 0 ? Math.round((totalInStay / maxCapacity) * 100) : 0;
  const capacityBarColour = capacityPercent > 90 ? 'bg-red-500' : capacityPercent > 75 ? 'bg-amber-500' : 'bg-green-500';
  const capacityTextColour = capacityPercent > 90 ? 'text-red-600' : capacityPercent > 75 ? 'text-amber-600' : 'text-green-600';

  const alerts = useMemo(() => {
    if (isAllLocations) return [];
    const items: { type: 'warning' | 'error'; message: string }[] = [];

    const unassignedDogs = boarders.filter(b => !b.assignedCarerUserId);
    if (unassignedDogs.length > 0) {
      items.push({
        type: 'warning',
        message: `${unassignedDogs.length} dog${unassignedDogs.length > 1 ? 's' : ''} unassigned to a carer`,
      });
    }

    const overCapacityCarers = carers.filter(c => c.currentLoad >= c.maxCapacity && c.maxCapacity > 0);
    if (overCapacityCarers.length > 0) {
      items.push({
        type: 'error',
        message: `${overCapacityCarers.length} carer${overCapacityCarers.length > 1 ? 's' : ''} at or over capacity`,
      });
    }

    const pendingTransitions = reservations.filter(r =>
      r.status === 'transitioning_from_daycare' || r.status === 'transitioning_to_daycare'
    );
    if (pendingTransitions.length > 0) {
      items.push({
        type: 'warning',
        message: `${pendingTransitions.length} pending transition${pendingTransitions.length > 1 ? 's' : ''} awaiting confirmation`,
      });
    }

    if (capacityPercent > 90) {
      items.push({
        type: 'error',
        message: `Overnight capacity at ${capacityPercent}%`,
      });
    }

    return items;
  }, [boarders, carers, reservations, capacityPercent, isAllLocations]);

  return (
    <WidgetCard
      title="Overnight Guests"
      icon={Moon}
      description="Current boarders"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{totalInStay}</div>
              <div className="text-xs text-slate-500">in stay</div>
            </div>
            {maxCapacity > 0 && (
              <div className="text-center">
                <div className={cn("text-lg font-semibold", capacityTextColour)}>
                  {capacityPercent}%
                </div>
                <div className="text-xs text-slate-500">capacity</div>
              </div>
            )}
          </div>
          <button
            onClick={loadData}
            disabled={localLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            title="Refresh"
          >
            <ArrowClockwise className={cn("h-4 w-4", localLoading && "animate-spin")} />
          </button>
        </div>

        {!isAllLocations && maxCapacity > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Overnight Capacity</span>
              <span>{totalInStay} / {maxCapacity}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", capacityBarColour)}
                style={{ width: `${Math.min(capacityPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-blue-50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-blue-700">{arrivingToday}</div>
            <div className="text-xs text-blue-600">arriving today</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-green-700">{departingToday}</div>
            <div className="text-xs text-green-600">departing today</div>
          </div>
        </div>

        {!isAllLocations && alerts.length > 0 && (
          <div className="space-y-2 mb-4">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-lg p-2.5 flex items-center gap-2 text-sm",
                  alert.type === 'error'
                    ? "bg-red-50 border border-red-200 text-red-800"
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                )}
              >
                {alert.type === 'error' ? (
                  <Warning className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <Warning className="h-4 w-4 flex-shrink-0" />
                )}
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-4 px-4">
          {isAllLocations ? (
            <div className="text-center py-6">
              <Moon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Select a location to see boarders</p>
              {reservations.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  {reservations.filter(r => r.status === 'in_stay' || r.status === 'checked_in').length} total across all locations
                </p>
              )}
            </div>
          ) : localLoading && boarders.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <ArrowClockwise className="h-6 w-6 text-slate-300 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <Warning className="h-4 w-4" />
                <span>Failed to load boarders</span>
              </div>
            </div>
          ) : boarders.length === 0 ? (
            <div className="text-center py-6">
              <Moon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No overnight guests currently</p>
            </div>
          ) : (
            <div className="space-y-2">
              {boarders.slice(0, 5).map((boarder) => (
                <button
                  key={boarder.reservationId}
                  onClick={() => navigate('/overnights')}
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-sm transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                      {boarder.petName?.charAt(0) || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-slate-900 truncate">{boarder.petName}</span>
                        <div className="flex items-center gap-1">
                          {boarder.requiresMedication && (
                            <span title="Requires medication"><Pill className="h-3.5 w-3.5 text-blue-500" /></span>
                          )}
                          {boarder.hasBehaviourConcerns && (
                            <span title="Behaviour concerns"><Warning className="h-3.5 w-3.5 text-amber-500" /></span>
                          )}
                          {boarder.hasAllergies && (
                            <span title="Has allergies"><Heart className="h-3.5 w-3.5 text-red-500" /></span>
                          )}
                          {boarder.careLogCompleted && (
                            <span title="Care log done"><CheckCircle className="h-3.5 w-3.5 text-green-500" /></span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {boarder.sleepingAreaName || 'No area assigned'}
                        {boarder.customerName && ` · ${boarder.customerName}`}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs">
                        {boarder.assignedCarerName ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                            <UserCheck className="h-3 w-3" />
                            {boarder.assignedCarerName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <UserMinus className="h-3 w-3" />
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    <CaretRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                  </div>
                </button>
              ))}

              {boarders.length > 5 && (
                <button
                  onClick={() => navigate('/overnights')}
                  className="w-full text-center py-2 text-sm text-primary hover:underline"
                >
                  View all {boarders.length} boarders →
                </button>
              )}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 mt-3">
          <button
            onClick={() => navigate('/overnights')}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-slate-900 py-2"
          >
            <span>Manage Overnights</span>
            <CaretRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </WidgetCard>
  );
}
