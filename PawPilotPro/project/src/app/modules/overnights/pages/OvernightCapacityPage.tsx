import React, { useState, useEffect } from 'react';
import { Bed, Moon, ArrowLeft, Gear, FloppyDisk, Warning, Money } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useOvernightsStore } from '../store';
import { useOvernightLocation } from '../hooks/useOvernightLocation';
import { LocationPrompt } from '../components/LocationPrompt';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { CapacityCalendar } from '../components/CapacityCalendar';
import { OvernightsCapacity } from '../types';
import { useCurrency } from '../../../utils/currency';

import { useBackNavigation } from '../../../components/BackButton';
export function OvernightCapacityPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/overnights');
  const { currency, symbol, format: formatMoney } = useCurrency();
  const { location: selectedLocation, needsSelection } = useOvernightLocation();
  const {
    capacities,
    tonightsBoarders,
    fetchCapacity,
    updateCapacity,
    fetchTonightsBoarders,
    isLoading,
    error,
  } = useOvernightsStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editMaxCapacity, setEditMaxCapacity] = useState(0);
  const [editBufferSlots, setEditBufferSlots] = useState(0);
  const [editPricePerNight, setEditPricePerNight] = useState(45);
  const [saveError, setSaveError] = useState<string | null>(null);

  const locationId = selectedLocation?.id;
  const capacity = capacities[0];

  useEffect(() => {
    if (locationId) {
      fetchCapacity(locationId);
      fetchTonightsBoarders(locationId);
    }
  }, [locationId]);

  useEffect(() => {
    if (capacity) {
      setEditMaxCapacity(capacity.maxOvernightCapacity);
      setEditBufferSlots(capacity.bufferSlots);
      setEditPricePerNight(capacity.pricePerNight ?? 45);
    }
  }, [capacity]);

  const handleSave = async () => {
    if (!locationId) return;
    setSaveError(null);
    try {
      await updateCapacity(locationId, {
        maxOvernightCapacity: editMaxCapacity,
        bufferSlots: editBufferSlots,
        pricePerNight: editPricePerNight,
      });
      setIsEditing(false);
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save capacity settings');
    }
  };

  if (!locationId) {
    return <LocationPrompt needsSelection={needsSelection} action="manage capacity" />;
  }

  const maxCap = capacity?.maxOvernightCapacity ?? 0;
  const bufferSlots = capacity?.bufferSlots ?? 0;
  const nightlyRate = capacity?.pricePerNight ?? 45;
  const currentOccupancy = tonightsBoarders?.totalInStay ?? 0;
  const effectiveCapacity = maxCap - bufferSlots;
  const availableSlots = effectiveCapacity - currentOccupancy;
  const utilizationPct = effectiveCapacity > 0 ? Math.round((currentOccupancy / effectiveCapacity) * 100) : 0;

  const getUtilisationColour = () => {
    if (utilizationPct >= 90) return 'text-rose-600';
    if (utilizationPct >= 75) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getBarColour = () => {
    if (utilizationPct >= 90) return 'bg-rose-500';
    if (utilizationPct >= 75) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Bed className="h-6 w-6 text-primary" />
              Capacity Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage overnight boarding capacity and view occupancy
            </p>
          </div>
        </div>
        {!isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Gear className="h-4 w-4 mr-1" />
            Edit Settings
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-tint flex items-center justify-center">
              <Bed className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{maxCap}</p>
              <p className="text-sm text-muted-foreground">Max Capacity</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <Warning className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{bufferSlots}</p>
              <p className="text-sm text-muted-foreground">Buffer Slots</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Moon className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">
                {currentOccupancy}
                <span className="text-sm font-normal text-tertiary-foreground ml-1">/ {effectiveCapacity}</span>
              </p>
              <p className="text-sm text-muted-foreground">Tonight's Occupancy</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              availableSlots > 0 ? 'bg-emerald-50' : 'bg-rose-50'
            }`}>
              <Bed className={`h-5 w-5 ${availableSlots > 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
            </div>
            <div>
              <p className={`text-2xl font-semibold ${availableSlots > 0 ? 'text-foreground' : 'text-rose-600'}`}>
                {availableSlots}
              </p>
              <p className="text-sm text-muted-foreground">Available Slots</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary-tint flex items-center justify-center">
            <Money className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{formatMoney(nightlyRate)}</p>
            <p className="text-sm text-muted-foreground">Nightly boarding rate · per dog, per night</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-foreground">Current Utilisation</h3>
          <span className={`text-sm font-semibold ${getUtilisationColour()}`}>
            {utilizationPct}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getBarColour()}`}
            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>{currentOccupancy} occupied</span>
          <span>{availableSlots > 0 ? `${availableSlots} available` : 'At capacity'}</span>
        </div>
      </Card>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gear className="h-5 w-5 text-muted-foreground" />
              Capacity Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {saveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
                {saveError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Maximum Overnight Capacity</Label>
                <Input
                  type="number"
                  min={0}
                  value={editMaxCapacity}
                  onChange={(e) => setEditMaxCapacity(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground">
                  Total number of dogs that can stay overnight
                </p>
              </div>
              <div className="space-y-2">
                <Label>Buffer Slots</Label>
                <Input
                  type="number"
                  min={0}
                  max={editMaxCapacity}
                  value={editBufferSlots}
                  onChange={(e) => setEditBufferSlots(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground">
                  Reserved slots for emergencies (not available for booking)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nightly Rate ({currency})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{symbol}</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editPricePerNight}
                    onChange={(e) => setEditPricePerNight(parseFloat(e.target.value) || 0)}
                    className="pl-12"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Charged per dog, per night. Used for every new reservation.
                </p>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Effective bookable capacity: <strong>{editMaxCapacity - editBufferSlots}</strong> slots
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                <FloppyDisk className="h-4 w-4 mr-1" />
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-primary" />
            14-Day Occupancy Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CapacityCalendar locationId={locationId} maxCapacity={maxCap} />
        </CardContent>
      </Card>
    </div>
  );
}
