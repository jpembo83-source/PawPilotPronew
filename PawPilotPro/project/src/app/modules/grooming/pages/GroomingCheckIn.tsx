import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useGroomingStore } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Stethoscope,
  Scissors,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { APPOINTMENT_STATUSES, SERVICE_TYPES } from '../types';
import type { GroomingCheckInValidation } from '../types';

import { useBackNavigation } from '../../../components/BackButton';
export function GroomingCheckIn() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/grooming/appointments');
  const { user } = useAuth();
  const {
    selectedAppointment,
    fetchAppointmentById,
    validateCheckIn,
    checkIn,
    isLoading,
  } = useGroomingStore();

  const [validation, setValidation] = useState<GroomingCheckInValidation | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState(false);

  useEffect(() => {
    if (id) {
      loadAppointment();
    }
  }, [id]);

  const loadAppointment = async () => {
    if (!id) return;
    try {
      await fetchAppointmentById(id);
      await runValidation();
    } catch (err: any) {
      toast.error(err.message || 'Failed to load appointment');
    }
  };

  const runValidation = async () => {
    if (!id) return;
    setIsValidating(true);
    try {
      const result = await validateCheckIn(id);
      setValidation(result);
    } catch (err: any) {
      setValidation({
        can_check_in: false,
        blockers: [{
          type: 'blocker',
          category: 'other',
          message: err.message || 'Validation check failed. Please try again or contact a manager.',
        }],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleCheckIn = async () => {
    if (!id) return;
    setIsCheckingIn(true);
    try {
      await checkIn(id, { notes: checkInNotes || undefined });
      toast.success(`${selectedAppointment?.pet_name || 'Pet'} checked in successfully`);
      navigate('/grooming');
    } catch (err: any) {
      toast.error(err.message || 'Failed to check in');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const hasBlockers = (validation?.blockers?.length || 0) > 0;
  const hasWarnings = (validation?.warnings?.length || 0) > 0;
  const canProceed = !hasBlockers && (!hasWarnings || acknowledgedWarnings);

  if (isLoading && !selectedAppointment) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!selectedAppointment) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Appointments
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Appointment not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const apt = selectedAppointment;
  const statusInfo = APPOINTMENT_STATUSES[apt.status];
  const serviceInfo = SERVICE_TYPES[apt.service_type];

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Check In</h1>
          <p className="text-slate-600 mt-1">Verify details and check in for grooming</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Appointment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Pet</p>
                <div className="flex items-center gap-2 mt-1">
                  {apt.pet_photo_url ? (
                    <img src={apt.pet_photo_url} alt={apt.pet_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg">
                      🐕
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{apt.pet_name}</p>
                    {apt.pet_breed && <p className="text-sm text-slate-500">{apt.pet_breed}</p>}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-medium">{apt.household_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <Badge className={`${statusInfo?.bgColor} ${statusInfo?.color}`}>
                  {statusInfo?.label || apt.status}
                </Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Service</p>
                <p className="font-medium">{apt.service_name || serviceInfo?.label}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-slate-500">Time</p>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {apt.appointment_time}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Duration</p>
                  <p className="font-medium">{apt.estimated_duration_minutes} min</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Groomer</p>
                <p className="font-medium">{apt.groomer_name || 'Unassigned'}</p>
              </div>
            </div>
          </div>

          {(apt.customer_notes || apt.grooming_instructions) && (
            <div className="mt-4 pt-4 border-t space-y-3">
              {apt.customer_notes && (
                <div>
                  <p className="text-sm font-medium text-slate-700">Customer Notes</p>
                  <p className="text-sm text-slate-600 mt-1">{apt.customer_notes}</p>
                </div>
              )}
              {apt.grooming_instructions && (
                <div>
                  <p className="text-sm font-medium text-slate-700">Grooming Instructions</p>
                  <p className="text-sm text-slate-600 mt-1">{apt.grooming_instructions}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {apt.has_behaviour_flag && (
          <Card className="flex-1 border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Behaviour Flag</p>
                  <p className="text-sm text-red-700">{apt.behaviour_notes || 'See pet record for details'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {apt.has_medical_flag && (
          <Card className="flex-1 border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Medical Flag</p>
                  <p className="text-sm text-amber-700">{apt.medical_notes || 'See pet record for details'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {isValidating ? (
        <Card>
          <CardContent className="py-8 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Running check-in validation...
          </CardContent>
        </Card>
      ) : validation && (hasBlockers || hasWarnings) ? (
        <Card className={hasBlockers ? 'border-red-200' : 'border-amber-200'}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${hasBlockers ? 'text-red-900' : 'text-amber-900'}`}>
              <AlertTriangle className="h-5 w-5" />
              {hasBlockers ? 'Check-In Blocked' : 'Warnings'}
            </CardTitle>
            <CardDescription>
              {hasBlockers
                ? 'The following issues must be resolved before check-in'
                : 'Please review the following before proceeding'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {validation.blockers?.map((issue, i) => (
              <div key={`blocker-${i}`} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">{issue.category}</p>
                  <p className="text-sm text-red-700">{issue.message}</p>
                </div>
              </div>
            ))}
            {validation.warnings?.map((issue, i) => (
              <div key={`warning-${i}`} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">{issue.category}</p>
                  <p className="text-sm text-amber-700">{issue.message}</p>
                </div>
              </div>
            ))}
            {hasWarnings && !hasBlockers && (
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgedWarnings}
                  onChange={(e) => setAcknowledgedWarnings(e.target.checked)}
                  className="rounded border-amber-300"
                />
                <span className="text-sm text-amber-900">I acknowledge these warnings and wish to proceed</span>
              </label>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-900">All checks passed — ready to check in</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Check-In Notes</CardTitle>
          <CardDescription>Add any notes observed at drop-off (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="checkin-notes" className="sr-only">Check-in notes</Label>
          <Textarea
            id="checkin-notes"
            placeholder="e.g. Owner mentioned matting on hind legs, dog is nervous today..."
            value={checkInNotes}
            onChange={(e) => setCheckInNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex gap-4 justify-end">
        <Button variant="outline" onClick={() => navigate('/grooming/appointments')}>
          Cancel
        </Button>
        <Button
          onClick={handleCheckIn}
          disabled={isCheckingIn || !canProceed}
          className="min-w-[140px]"
        >
          {isCheckingIn ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking In...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Check In
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
