import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SquaresFour, Warning, Moon, Pill, Dog, Heart, ArrowLeft, ArrowClockwise } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { useOvernightsStore } from '../store';
import { useOvernightLocation } from '../hooks/useOvernightLocation';
import { LocationPrompt } from '../components/LocationPrompt';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { cn } from '../../../components/ui/utils';
import type { OvernightCarerInfo, BoarderSummary } from '../types';

import { useBackNavigation } from '../../../components/BackButton';
const DRAG_TYPE = 'BOARDER_CARD';

interface DragItem {
  reservationId: string;
  currentCarerId: string | null;
}

function getCapacityColour(load: number, max: number): string {
  if (max === 0) return 'bg-muted';
  const pct = (load / max) * 100;
  if (pct > 90) return 'bg-red-500';
  if (pct >= 75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getCapacityTextColour(load: number, max: number): string {
  if (max === 0) return 'text-muted-foreground';
  const pct = (load / max) * 100;
  if (pct > 90) return 'text-red-600';
  if (pct >= 75) return 'text-amber-600';
  return 'text-emerald-600';
}

function BoarderCard({ boarder, carerId }: { boarder: BoarderSummary; carerId: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE,
    item: (): DragItem => ({
      reservationId: boarder.reservationId,
      currentCarerId: carerId,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(ref);

  return (
    <div
      ref={ref}
      className={cn(
        'border border-border rounded-lg p-3 bg-card cursor-grab active:cursor-grabbing transition-all',
        isDragging && 'opacity-40 scale-95',
        'hover:border-ring/40 hover:shadow-sm'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="h-7 w-7 rounded-full bg-primary-tint flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {boarder.petName?.charAt(0) || '?'}
        </div>
        <span className="font-medium text-sm text-foreground truncate">{boarder.petName}</span>
      </div>
      <p className="text-sm text-muted-foreground ml-9 truncate">{boarder.customerName}</p>
      <div className="flex flex-wrap gap-1 mt-2 ml-9">
        {boarder.requiresMedication && (
          <Badge variant="outline" className="text-sm px-1.5 py-0 text-rose-600 border-rose-200 gap-0.5">
            <Pill className="h-3 w-3" />
            Medication
          </Badge>
        )}
        {boarder.hasBehaviourConcerns && (
          <Badge variant="outline" className="text-sm px-1.5 py-0 text-amber-600 border-amber-200 gap-0.5">
            <Dog className="h-3 w-3" />
            Behaviour
          </Badge>
        )}
        {boarder.hasAllergies && (
          <Badge variant="outline" className="text-sm px-1.5 py-0 text-purple-600 border-purple-200 gap-0.5">
            <Heart className="h-3 w-3" />
            Allergies
          </Badge>
        )}
      </div>
      {boarder.specialNotes && (
        <p className="text-sm text-tertiary-foreground mt-1 ml-9 truncate">{boarder.specialNotes}</p>
      )}
    </div>
  );
}

function CarerColumn({
  carer,
  boarders,
  onDrop,
  isProcessing,
}: {
  carer: OvernightCarerInfo | null;
  boarders: BoarderSummary[];
  onDrop: (reservationId: string, carerId: string | null) => void;
  isProcessing: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const targetCarerId = carer?.userId ?? null;

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DRAG_TYPE,
    drop: (item: DragItem) => {
      if (item.currentCarerId !== targetCarerId) {
        onDrop(item.reservationId, targetCarerId);
      }
    },
    canDrop: (item: DragItem) => {
      if (item.currentCarerId === targetCarerId) return false;
      if (carer && carer.currentLoad >= carer.maxCapacity) return false;
      return true;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  drop(ref);

  const isUnassigned = carer === null;
  const load = isUnassigned ? boarders.length : carer.currentLoad;
  const max = isUnassigned ? 0 : carer.maxCapacity;
  const capacityColour = isUnassigned ? 'bg-muted' : getCapacityColour(load, max);
  const capacityText = isUnassigned ? 'text-muted-foreground' : getCapacityTextColour(load, max);

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col min-w-[260px] max-w-[320px] w-full rounded-lg border transition-colors',
        isOver && canDrop && 'border-primary bg-primary-tint',
        isOver && !canDrop && 'border-red-300 bg-red-50/30',
        !isOver && 'border-border bg-muted/40'
      )}
    >
      <div className="p-3 border-b border-border bg-card rounded-t-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm text-foreground truncate">
            {isUnassigned ? 'Unassigned' : carer.name}
          </h3>
          {!isUnassigned && !carer.isOnRota && (
            <Badge variant="outline" className="text-sm px-1.5 py-0 text-amber-600 border-amber-200">
              Not on Rota
            </Badge>
          )}
        </div>
        {!isUnassigned && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className={cn('font-medium', capacityText)}>
                {load} / {max}
              </span>
              <span className="text-tertiary-foreground">
                {max - load > 0 ? `${max - load} available` : 'Full'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', capacityColour)}
                style={{ width: `${max > 0 ? Math.min((load / max) * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        )}
        {isUnassigned && (
          <p className="text-sm text-tertiary-foreground">{boarders.length} dog{boarders.length !== 1 ? 's' : ''} awaiting allocation</p>
        )}
      </div>

      <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-380px)]">
        {boarders.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-tertiary-foreground py-8">
            {isUnassigned ? 'All dogs assigned' : 'Drag dogs here'}
          </div>
        )}
        {boarders.map((b) => (
          <BoarderCard key={b.reservationId} boarder={b} carerId={targetCarerId} />
        ))}
      </div>

      {isProcessing && (
        <div className="p-2 text-center">
          <ArrowClockwise className="h-4 w-4 animate-spin text-primary mx-auto" />
        </div>
      )}
    </div>
  );
}

function PlanningBoardContent() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/overnights');
  const { location: selectedLocation, needsSelection } = useOvernightLocation();
  const {
    reservations,
    carers,
    tonightsBoarders,
    fetchReservations,
    fetchCarers,
    fetchTonightsBoarders,
    assignCarer,
    isLoading,
    error,
  } = useOvernightsStore();

  const [processingReservation, setProcessingReservation] = useState<string | null>(null);

  const locationId = selectedLocation?.id;

  useEffect(() => {
    if (locationId) {
      fetchReservations(locationId);
      fetchCarers(locationId);
      fetchTonightsBoarders(locationId);
    }
  }, [locationId]);

  const handleRefresh = useCallback(() => {
    if (locationId) {
      fetchReservations(locationId);
      fetchCarers(locationId);
      fetchTonightsBoarders(locationId);
    }
  }, [locationId]);

  const handleDrop = useCallback(async (reservationId: string, carerId: string | null) => {
    if (!carerId) return;
    setProcessingReservation(reservationId);
    try {
      await assignCarer(reservationId, carerId);
      if (locationId) {
        await fetchCarers(locationId);
        await fetchTonightsBoarders(locationId);
      }
    } catch {
    } finally {
      setProcessingReservation(null);
    }
  }, [assignCarer, locationId, fetchCarers, fetchTonightsBoarders]);

  if (!selectedLocation) {
    return <LocationPrompt needsSelection={needsSelection} action="view the planning board" />;
  }

  const today = new Date().toISOString().split('T')[0];
  const boarders: BoarderSummary[] = tonightsBoarders?.boarders || [];

  const unassignedBoarders = boarders.filter((b) => !b.assignedCarerUserId);
  const carerBoardersMap = new Map<string, BoarderSummary[]>();
  for (const c of carers) {
    carerBoardersMap.set(c.userId, []);
  }
  for (const b of boarders) {
    if (b.assignedCarerUserId && carerBoardersMap.has(b.assignedCarerUserId)) {
      carerBoardersMap.get(b.assignedCarerUserId)!.push(b);
    } else if (b.assignedCarerUserId) {
      if (!carerBoardersMap.has(b.assignedCarerUserId)) {
        carerBoardersMap.set(b.assignedCarerUserId, []);
      }
      carerBoardersMap.get(b.assignedCarerUserId)!.push(b);
    }
  }

  const notOnRota = carers.filter((c) => !c.isOnRota || !c.rotaPublished);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <SquaresFour className="h-6 w-6 text-purple-600" />
              Planning Board
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Allocate dogs to overnight carers — {selectedLocation.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {boarders.length} boarder{boarders.length !== 1 ? 's' : ''} tonight
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              'text-sm',
              unassignedBoarders.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            )}
          >
            {unassignedBoarders.length} unassigned
          </Badge>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleRefresh} disabled={isLoading}>
            <ArrowClockwise className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {notOnRota.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Warning className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Rota Warning:</span>{' '}
            {notOnRota.map((c) => c.name).join(', ')}{' '}
            {notOnRota.length === 1 ? 'is' : 'are'} not on a published rota for tonight.
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        <CarerColumn
          carer={null}
          boarders={unassignedBoarders}
          onDrop={handleDrop}
          isProcessing={false}
        />

        {carers.map((carer) => (
          <CarerColumn
            key={carer.userId}
            carer={carer}
            boarders={carerBoardersMap.get(carer.userId) || []}
            onDrop={handleDrop}
            isProcessing={processingReservation !== null}
          />
        ))}

        {carers.length === 0 && (
          <Card className="min-w-[260px] p-8 flex flex-col items-center justify-center text-tertiary-foreground">
            <Moon className="h-8 w-8 mb-2" />
            <p className="text-sm text-center">No carers found for this location</p>
            <p className="text-sm text-center mt-1">Ensure carers are assigned to overnight shifts</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// The HTML5 drag backend does not fire on touch devices at all — night staff
// on a tablet or phone could never allocate a dog. Pick the backend by the
// device's primary pointer; enableMouseEvents keeps hybrid devices working.
const isCoarsePointer =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function OvernightPlanningBoard() {
  return (
    <DndProvider
      backend={isCoarsePointer ? TouchBackend : HTML5Backend}
      options={isCoarsePointer ? { enableMouseEvents: true } : undefined}
    >
      <PlanningBoardContent />
    </DndProvider>
  );
}
