import React, { useState, useEffect } from 'react';
import { Utensils, Pill, Dog, Moon, Heart, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Checkbox } from '../../../components/ui/checkbox';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { NightlyCareLog } from '../types';
import { registerActiveEdit } from '../../../components/ConflictNotification';

interface CareLogFormProps {
  reservationId: string;
  petId: string;
  petName: string;
  locationId: string;
  existingLog?: NightlyCareLog;
  requiresMedication?: boolean;
  onSubmit: (log: Omit<NightlyCareLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CareLogForm({
  reservationId,
  petId,
  petName,
  locationId,
  existingLog,
  requiresMedication,
  onSubmit,
  onCancel,
  isLoading = false,
}: CareLogFormProps) {
  const [feedingCompleted, setFeedingCompleted] = useState(existingLog?.feedingCompleted ?? false);
  const [feedingTime, setFeedingTime] = useState(existingLog?.feedingTime ?? '');
  const [feedingNotes, setFeedingNotes] = useState(existingLog?.feedingNotes ?? '');

  const [medicationAdministered, setMedicationAdministered] = useState(existingLog?.medicationAdministered ?? false);
  const [medicationTime, setMedicationTime] = useState(existingLog?.medicationTime ?? '');
  const [medicationDetails, setMedicationDetails] = useState(existingLog?.medicationDetails ?? '');

  const [toiletBreakCompleted, setToiletBreakCompleted] = useState(existingLog?.toiletBreakCompleted ?? false);
  const [toiletBreakTime, setToiletBreakTime] = useState(existingLog?.toiletBreakTime ?? '');
  const [toiletBreakNotes, setToiletBreakNotes] = useState(existingLog?.toiletBreakNotes ?? '');

  const [sleepQuality, setSleepQuality] = useState<NightlyCareLog['sleepQuality']>(existingLog?.sleepQuality);
  const [behaviourNotes, setBehaviourNotes] = useState(existingLog?.behaviourNotes ?? '');
  const [healthObservations, setHealthObservations] = useState(existingLog?.healthObservations ?? '');

  const [hasIncident, setHasIncident] = useState(existingLog?.hasIncident ?? false);

  useEffect(() => {
    if (existingLog?.id) {
      return registerActiveEdit('overnights', 'care_log', existingLog.id);
    }
  }, [existingLog?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    await onSubmit({
      reservationId,
      petId,
      locationId,
      logDate: new Date().toISOString().split('T')[0],
      feedingCompleted,
      feedingTime: feedingTime || undefined,
      feedingNotes: feedingNotes || undefined,
      medicationAdministered,
      medicationTime: medicationTime || undefined,
      medicationDetails: medicationDetails || undefined,
      toiletBreakCompleted,
      toiletBreakTime: toiletBreakTime || undefined,
      toiletBreakNotes: toiletBreakNotes || undefined,
      behaviourNotes: behaviourNotes || undefined,
      healthObservations: healthObservations || undefined,
      sleepQuality,
      hasIncident,
      completedBy: '',
      completedAt: now,
    });
  };

  const sleepQualityOptions: { value: NonNullable<NightlyCareLog['sleepQuality']>; label: string; colour: string }[] = [
    { value: 'excellent', label: 'Excellent', colour: 'bg-emerald-100 text-emerald-700' },
    { value: 'good', label: 'Good', colour: 'bg-blue-100 text-blue-700' },
    { value: 'restless', label: 'Restless', colour: 'bg-amber-100 text-amber-700' },
    { value: 'poor', label: 'Poor', colour: 'bg-rose-100 text-rose-700' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
          {petName.charAt(0)}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{petName}</h3>
          <p className="text-sm text-slate-500">Nightly Care Log</p>
        </div>
        {requiresMedication && (
          <Badge variant="outline" className="text-rose-600 border-rose-200 ml-auto">
            <Pill className="h-3 w-3 mr-1" />
            Medication Required
          </Badge>
        )}
      </div>

      <div className="space-y-4 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Utensils className="h-4 w-4 text-orange-600" />
          <h4 className="font-medium text-slate-900">Feeding</h4>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={feedingCompleted}
            onCheckedChange={(checked) => setFeedingCompleted(checked === true)}
          />
          <Label>Feeding completed</Label>
        </div>
        {feedingCompleted && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={feedingTime}
                onChange={(e) => setFeedingTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="e.g. ate well, left some food"
                value={feedingNotes}
                onChange={(e) => setFeedingNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Pill className="h-4 w-4 text-rose-600" />
          <h4 className="font-medium text-slate-900">Medication</h4>
          {requiresMedication && (
            <Badge variant="outline" className="text-xs text-rose-600 border-rose-200">Required</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={medicationAdministered}
            onCheckedChange={(checked) => setMedicationAdministered(checked === true)}
          />
          <Label>Medication administered</Label>
        </div>
        {medicationAdministered && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={medicationTime}
                onChange={(e) => setMedicationTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Input
                placeholder="Medication name and dosage"
                value={medicationDetails}
                onChange={(e) => setMedicationDetails(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Dog className="h-4 w-4 text-emerald-600" />
          <h4 className="font-medium text-slate-900">Toilet Break</h4>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={toiletBreakCompleted}
            onCheckedChange={(checked) => setToiletBreakCompleted(checked === true)}
          />
          <Label>Toilet break completed</Label>
        </div>
        {toiletBreakCompleted && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={toiletBreakTime}
                onChange={(e) => setToiletBreakTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Any observations"
                value={toiletBreakNotes}
                onChange={(e) => setToiletBreakNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Moon className="h-4 w-4 text-indigo-600" />
          <h4 className="font-medium text-slate-900">Sleep Quality</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {sleepQualityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSleepQuality(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                sleepQuality === opt.value
                  ? `${opt.colour} ring-2 ring-offset-1 ring-slate-400`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-4 w-4 text-pink-600" />
          <h4 className="font-medium text-slate-900">Behaviour & Health</h4>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Behaviour Notes</Label>
            <Textarea
              placeholder="How was the dog behaving? Any concerns?"
              value={behaviourNotes}
              onChange={(e) => setBehaviourNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Health Observations</Label>
            <Textarea
              placeholder="Any health observations to note?"
              value={healthObservations}
              onChange={(e) => setHealthObservations(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 border border-amber-200 rounded-lg p-4 bg-amber-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h4 className="font-medium text-amber-800">Incident</h4>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={hasIncident}
            onCheckedChange={(checked) => setHasIncident(checked === true)}
          />
          <Label className="text-amber-800">An incident occurred during this stay</Label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : existingLog ? 'Update Care Log' : 'Save Care Log'}
        </Button>
      </div>
    </form>
  );
}
