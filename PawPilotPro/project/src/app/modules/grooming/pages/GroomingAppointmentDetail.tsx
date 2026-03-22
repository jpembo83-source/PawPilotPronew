import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useGroomingStore } from '../store';
import { registerActiveEdit } from '../../../components/ConflictNotification';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  ArrowLeft,
  Scissors,
  Clock,
  Play,
  CheckCircle,
  LogOut,
  XCircle,
  AlertTriangle,
  Stethoscope,
  ShieldAlert,
  DollarSign,
  Plus,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { APPOINTMENT_STATUSES, SERVICE_TYPES } from '../types';
import type { GroomingAppointment, AdditionalCharge } from '../types';

export function GroomingAppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    selectedAppointment,
    groomers,
    isLoading,
    fetchAppointmentById,
    fetchGroomers,
    startGrooming,
    completeGrooming,
    checkOut,
    cancelAppointment,
    updateAppointment,
  } = useGroomingStore();

  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);

  const [selectedGroomerId, setSelectedGroomerId] = useState('');
  const [groomerNotes, setGroomerNotes] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeReason, setChargeReason] = useState<AdditionalCharge['reason']>('add_on_service');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAppointmentById(id);
      fetchGroomers();
    }
  }, [id]);

  const anyDialogOpen = showStartDialog || showCompleteDialog || showCheckoutDialog || showCancelDialog || showChargeDialog;
  useEffect(() => {
    if (id && anyDialogOpen) {
      return registerActiveEdit('grooming', 'appointment', id);
    }
  }, [id, anyDialogOpen]);

  const handleStartGrooming = async () => {
    if (!id || !selectedGroomerId) {
      toast.error('Please select a groomer');
      return;
    }
    setIsProcessing(true);
    try {
      await startGrooming(id, selectedGroomerId);
      toast.success('Grooming started');
      setShowStartDialog(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteGrooming = async () => {
    if (!id) return;
    setIsProcessing(true);
    try {
      await completeGrooming(id, {
        groomer_notes: groomerNotes || undefined,
      });
      toast.success('Grooming completed');
      setShowCompleteDialog(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (!id) return;
    setIsProcessing(true);
    try {
      await checkOut(id, checkoutNotes || undefined);
      toast.success('Pet checked out');
      setShowCheckoutDialog(false);
      navigate('/grooming');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    setIsProcessing(true);
    try {
      await cancelAppointment(id, cancelReason);
      toast.success('Appointment cancelled');
      setShowCancelDialog(false);
      navigate('/grooming/appointments');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCharge = async () => {
    if (!id || !chargeDescription.trim() || !chargeAmount) {
      toast.error('Please fill in all charge details');
      return;
    }
    setIsProcessing(true);
    try {
      const newCharge: Partial<AdditionalCharge> = {
        description: chargeDescription,
        amount: parseFloat(chargeAmount),
        reason: chargeReason,
        added_by_id: user?.id || '',
        added_by_name: user?.full_name || user?.email || '',
      };
      const existingCharges = selectedAppointment?.additional_charges || [];
      await updateAppointment(id, {
        additional_charges: [...existingCharges, newCharge as AdditionalCharge],
      });
      toast.success('Charge added');
      setShowChargeDialog(false);
      setChargeDescription('');
      setChargeAmount('');
      fetchAppointmentById(id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

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
        <Button variant="ghost" onClick={() => navigate('/grooming/appointments')}>
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
  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager';
  const totalCharges = (apt.additional_charges || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  const displayTotal = apt.total_price || (apt.base_price + totalCharges);

  const getStatusActions = () => {
    switch (apt.status) {
      case 'confirmed':
        return (
          <Button onClick={() => navigate(`/grooming/check-in/${apt.id}`)}>
            <UserCheck className="h-4 w-4 mr-2" />
            Check In
          </Button>
        );
      case 'checked_in':
        return (
          <Button onClick={() => {
            setSelectedGroomerId(apt.groomer_id || '');
            setShowStartDialog(true);
          }}>
            <Play className="h-4 w-4 mr-2" />
            Start Grooming
          </Button>
        );
      case 'in_progress':
        return (
          <Button onClick={() => {
            setGroomerNotes(apt.groomer_notes || '');
            setShowCompleteDialog(true);
          }}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Grooming
          </Button>
        );
      case 'completed':
        return (
          <Button onClick={() => {
            setCheckoutNotes('');
            setShowCheckoutDialog(true);
          }}>
            <LogOut className="h-4 w-4 mr-2" />
            Check Out
          </Button>
        );
      default:
        return null;
    }
  };

  const getTimelineSteps = () => {
    const steps = [
      { label: 'Confirmed', time: apt.created_at, done: true },
      { label: 'Checked In', time: apt.actual_check_in_time, done: ['checked_in', 'in_progress', 'completed'].includes(apt.status) },
      { label: 'In Progress', time: apt.grooming_started_at, done: ['in_progress', 'completed'].includes(apt.status) },
      { label: 'Completed', time: apt.grooming_completed_at, done: apt.status === 'completed' },
      { label: 'Checked Out', time: apt.actual_check_out_time, done: !!apt.actual_check_out_time },
    ];
    return steps;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/grooming/appointments')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{apt.pet_name}</h1>
            <p className="text-slate-600 mt-1">{apt.household_name} &middot; {apt.service_name || serviceInfo?.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusInfo?.bgColor} ${statusInfo?.color} text-sm px-3 py-1`}>
            {statusInfo?.label || apt.status}
          </Badge>
          {getStatusActions()}
          {isAdmin && ['requested', 'confirmed'].includes(apt.status) && (
            <Button variant="ghost" size="sm" onClick={() => {
              setCancelReason('');
              setShowCancelDialog(true);
            }}>
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                Appointment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-sm text-slate-500">Pet</p>
                  <div className="flex items-center gap-2 mt-1">
                    {apt.pet_photo_url ? (
                      <img src={apt.pet_photo_url} alt={apt.pet_name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">🐕</div>
                    )}
                    <div>
                      <p className="font-medium">{apt.pet_name}</p>
                      {apt.pet_breed && <p className="text-xs text-slate-500">{apt.pet_breed}</p>}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Service</p>
                  <p className="font-medium mt-1">{apt.service_name || serviceInfo?.label}</p>
                  <p className="text-xs text-slate-500">{apt.estimated_duration_minutes} minutes</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date & Time</p>
                  <p className="font-medium mt-1 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {apt.appointment_date} at {apt.appointment_time}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Groomer</p>
                  <p className="font-medium mt-1">{apt.groomer_name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Location</p>
                  <p className="font-medium mt-1">{apt.location_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Vaccination Status</p>
                  <Badge 
                    variant={apt.vaccination_status === 'valid' || apt.vaccination_status === 'up_to_date' ? 'outline' : 'destructive'} 
                    className={`mt-1 ${
                      apt.vaccination_status === 'valid' || apt.vaccination_status === 'up_to_date' ? 'border-green-300 text-green-700' :
                      apt.vaccination_status === 'expiring_soon' ? 'bg-orange-500' : ''
                    }`}
                  >
                    {apt.vaccination_status === 'valid' || apt.vaccination_status === 'up_to_date' ? 'Up to Date' :
                     apt.vaccination_status === 'expired' ? 'Expired' :
                     apt.vaccination_status === 'expiring_soon' ? 'Expiring Soon' :
                     apt.vaccination_status === 'missing' || apt.vaccination_status === 'unknown' ? 'Not Recorded' :
                     'Unknown'}
                  </Badge>
                </div>
              </div>

              {(apt.customer_notes || apt.grooming_instructions || apt.style_preferences) && (
                <div className="mt-6 pt-4 border-t space-y-3">
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
                  {apt.style_preferences && (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Style Preferences</p>
                      <p className="text-sm text-slate-600 mt-1">{apt.style_preferences}</p>
                    </div>
                  )}
                </div>
              )}

              {apt.groomer_notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-slate-700">Groomer Notes</p>
                  <p className="text-sm text-slate-600 mt-1">{apt.groomer_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(apt.has_behaviour_flag || apt.has_medical_flag || apt.has_matting) && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="h-5 w-5" />
                  Flags & Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {apt.has_behaviour_flag && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                    <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">Behaviour Flag</p>
                      <p className="text-sm text-red-700">{apt.behaviour_notes || 'Review pet record'}</p>
                    </div>
                  </div>
                )}
                {apt.has_medical_flag && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                    <Stethoscope className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">Medical Flag</p>
                      <p className="text-sm text-amber-700">{apt.medical_notes || 'Review pet record'}</p>
                    </div>
                  </div>
                )}
                {apt.has_matting && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                    <Scissors className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-900">Matting</p>
                      <p className="text-sm text-orange-700">
                        Severity: {apt.matting_severity || 'Not specified'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {getTimelineSteps().map((step, i, arr) => (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 ${
                        step.done ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'
                      }`} />
                      {i < arr.length - 1 && (
                        <div className={`w-0.5 h-8 ${step.done ? 'bg-green-300' : 'bg-slate-200'}`} />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={`text-sm font-medium ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>
                        {step.label}
                      </p>
                      {step.time && step.done && (
                        <p className="text-xs text-slate-500">{step.time}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Pricing
                </span>
                {['checked_in', 'in_progress'].includes(apt.status) && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setChargeDescription('');
                    setChargeAmount('');
                    setChargeReason('add_on_service');
                    setShowChargeDialog(true);
                  }}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Charge
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Base price</span>
                  <span className="font-medium">{apt.currency || '£'}{(apt.base_price || 0).toFixed(2)}</span>
                </div>
                {(apt.additional_charges || []).map((charge, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{charge.description}</span>
                    <span className="font-medium">{apt.currency || '£'}{(charge.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total</span>
                  <span>{apt.currency || '£'}{displayTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {apt.next_appointment_recommended && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="py-4">
                <p className="text-sm font-medium text-blue-900">Next appointment recommended</p>
                <p className="text-sm text-blue-700">{apt.next_appointment_recommended}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Grooming</DialogTitle>
            <DialogDescription>Assign a groomer and begin the session for {apt.pet_name}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Groomer</Label>
            <Select value={selectedGroomerId} onValueChange={setSelectedGroomerId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a groomer" />
              </SelectTrigger>
              <SelectContent>
                {groomers.filter(g => g.is_active && !g.is_on_break && !g.current_appointment_id).map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
                {groomers.filter(g => g.is_active && !g.is_on_break && !g.current_appointment_id).length === 0 && (
                  <SelectItem value="__none" disabled>No available groomers</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancel</Button>
            <Button onClick={handleStartGrooming} disabled={isProcessing || !selectedGroomerId}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Grooming</DialogTitle>
            <DialogDescription>Mark grooming as complete for {apt.pet_name}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Groomer Notes</Label>
              <Textarea
                placeholder="Notes about the groom, coat condition, recommendations..."
                value={groomerNotes}
                onChange={(e) => setGroomerNotes(e.target.value)}
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Cancel</Button>
            <Button onClick={handleCompleteGrooming} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out</DialogTitle>
            <DialogDescription>Check out {apt.pet_name} — notify the owner their dog is ready</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Checkout Notes (optional)</Label>
            <Textarea
              placeholder="Any notes for pickup..."
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>Cancel</Button>
            <Button onClick={handleCheckout} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
              Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>Cancel the appointment for {apt.pet_name}?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Cancellation Reason</Label>
            <Input
              placeholder="Enter reason..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Keep Appointment</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isProcessing || !cancelReason.trim()}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Charge</DialogTitle>
            <DialogDescription>Add an additional charge to this appointment</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                placeholder="e.g. Extra matting removal"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Amount ({apt.currency || '£'})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={chargeReason} onValueChange={(v) => setChargeReason(v as AdditionalCharge['reason'])}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matting">Matting</SelectItem>
                  <SelectItem value="extra_time">Extra Time</SelectItem>
                  <SelectItem value="add_on_service">Add-on Service</SelectItem>
                  <SelectItem value="special_handling">Special Handling</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeDialog(false)}>Cancel</Button>
            <Button onClick={handleAddCharge} disabled={isProcessing || !chargeDescription.trim() || !chargeAmount}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Charge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
