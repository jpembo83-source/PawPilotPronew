/**
 * Transport Job Detail - Operational execution view
 * Shows full job details and allows status progression
 * British English throughout, production-grade, no mock data
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTransportStore } from '../store';
import { TimePicker } from '../components/TimePicker';
import { useSettingsStore } from '../../settings/store';
import { useUserStore } from '../../settings/stores/userStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { 
  ArrowLeft,
  MapPin,
  CalendarBlank,
  Clock,
  Truck,
  User,
  Phone,
  EnvelopeSimple,
  NavigationArrow,
  CheckCircle,
  Warning,
  CircleNotch,
  PencilSimple,
  Trash,
  ChatTeardrop
} from '@phosphor-icons/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import type { TransportJobWithDetails } from '../types';

import { useBackNavigation } from '../../../components/BackButton';
export function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/transport');
  const { jobs, vehicles, isLoading, error, activeDriverCount, fetchJobs, fetchVehicles, fetchActiveDrivers, updateJobStatus, assignDriver, deleteJob } = useTransportStore();
  const { locations } = useSettingsStore();
  const { users, fetchUsers } = useUserStore();
  const { hasPermission } = usePermissions();
  const { updateJob } = useTransportStore();
  const { confirm, confirmDialog } = useConfirmDialog();

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // Remove this problematic useEffect that causes infinite loops
  // useEffect(() => {
  //   fetchActiveDrivers();
  // }, [fetchActiveDrivers]);
  
  useEffect(() => {
    if (jobId) {
      // Fetch the specific job
      fetchJobs({});
    }
  }, [jobId, fetchJobs]);
  
  const job = jobs.find(j => j.id === jobId);
  
  useEffect(() => {
    if (job) {
      fetchVehicles(job.location_id);
      // Fetch active drivers for this job's location
      fetchActiveDrivers(job.location_id);
    }
  }, [job?.id, job?.location_id]); // Use primitive values instead of functions
  
  // Get users with the Driver template assigned - MUST be before any early returns
  const availableDrivers = React.useMemo(() => {
    return users
      .filter(u => u.isActive && u.templateId === 'tpl-driver')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Drivers that exist but are disabled — so we can tell the dispatcher the
  // real reason there are zero *active* drivers ("your driver is disabled")
  // instead of the misleading "no drivers configured".
  const disabledDrivers = React.useMemo(() => {
    return users.filter(u => !u.isActive && u.templateId === 'tpl-driver');
  }, [users]);

  // When the assign dialog opens with exactly one vehicle, pre-select it —
  // there's nothing to choose, so make it a one-tap Assign.
  useEffect(() => {
    if (showAssignDialog && vehicles.length === 1 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [showAssignDialog, vehicles, selectedVehicleId]);
  
  const handleStatusUpdate = async (eventType: string) => {
    if (!job) return;
    
    try {
      await updateJobStatus(job.id, eventType, actionNotes || undefined);
      setActionNotes('');
      toast.success(`Job status updated to ${eventType}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleSaveEdit = async (updates: {
    service_date: string;
    time_window_start: string;
    time_window_end: string;
    address_pickup: string;
    address_dropoff: string;
    notes: string;
  }) => {
    if (!job) return;
    try {
      await updateJob(job.id, {
        service_date: updates.service_date,
        time_window_start: updates.time_window_start || undefined,
        time_window_end: updates.time_window_end || undefined,
        address_pickup: updates.address_pickup || undefined,
        address_dropoff: updates.address_dropoff || undefined,
        notes: updates.notes || undefined,
      });
      setShowEditDialog(false);
      toast.success('Transport job updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update job');
    }
  };

  const handleAssignDriver = async () => {
    if (!job || !selectedVehicleId) return;

    try {
      // Pass undefined if no driver selected — the server falls back to the
      // vehicle's default driver.
      const driverToAssign = selectedDriverId.trim() || undefined;
      await assignDriver(job.id, driverToAssign, selectedVehicleId);
      setShowAssignDialog(false);
      setSelectedDriverId('');
      setSelectedVehicleId('');
      toast.success('Driver assigned successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign driver');
    }
  };

  const handleCancelJob = async () => {
    if (!job) return;
    const reason = window.prompt('Cancellation reason:');
    // prompt returns null on Cancel; empty string means they confirmed with
    // no reason. Only abort on an explicit dismissal.
    if (reason === null) return;
    try {
      await updateJobStatus(job.id, 'cancelled', reason.trim() || undefined);
      toast.success('Job cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };
  
  const handleDeleteJob = async () => {
    if (!job) return;
    
    const confirmed = await confirm({
      title: 'Delete this transport job?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteJob(job.id);
      navigate('/transport');
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };
  
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="text-center">
          <CircleNotch className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }
  
  if (error || !job) {
    return (
      <div className="h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <Warning className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Job Not Found</h3>
          <p className="text-muted-foreground mb-4">
            {error || 'The transport job you\'re looking for could not be found.'}
          </p>
          <Button onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transport
          </Button>
        </div>
      </div>
    );
  }
  
  const location = locations.find(l => l.id === job.location_id);
  const statusColors: Record<string, string> = {
    scheduled: 'bg-muted text-foreground',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-teal-100 text-teal-700',
    failed: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  const isTerminal = job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed';
  const canStart = job.status === 'scheduled' && job.assigned_driver_user_id;
  const canComplete = job.status === 'in_progress';
  const canCancel = !isTerminal;
  const canEdit = job.status === 'scheduled' && hasPermission('transport', 'update');
  
  return (
    <div className="h-[calc(100vh-100px)] overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header — wraps on mobile so the badge/actions don't overflow */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              onClick={goBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Transport Job Details</h1>
              <p className="text-muted-foreground">Job #{job.id.slice(0, 12)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={statusColors[job.status]} variant="secondary">
              {job.status.replace('_', ' ')}
            </Badge>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(true)}
              >
                <PencilSimple className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {job.status === 'scheduled' && hasPermission('transport', 'delete') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteJob}
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Information */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Job Information</h2>
              
              <div className="space-y-4">
                {/* Date & Time */}
                <div className="flex items-start gap-3">
                  <CalendarBlank className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {format(new Date(job.service_date), 'EEEE, MMMM d, yyyy')}
                    </div>
                    {job.time_window_start && job.time_window_end && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {job.time_window_start} - {job.time_window_end}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Direction */}
                <div className="flex items-start gap-3">
                  <NavigationArrow className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-foreground capitalize">
                      {job.direction === 'roundtrip' ? 'Round Trip' : job.direction}
                    </div>
                  </div>
                </div>
                
                {/* Pickup Address */}
                {job.address_pickup && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pick-up</div>
                      <div className="text-sm text-foreground mt-1">{job.address_pickup}</div>
                    </div>
                  </div>
                )}
                
                {/* Dropoff Address */}
                {job.address_dropoff && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drop-off</div>
                      <div className="text-sm text-foreground mt-1">{job.address_dropoff}</div>
                    </div>
                  </div>
                )}
                
                {/* Notes */}
                {job.notes && (
                  <div className="pt-4 border-t border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
                    <div className="text-sm text-foreground">{job.notes}</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Pet & Household */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Pet & Household</h2>
              
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Pet</div>
                  <div className="text-base font-medium text-foreground">{job.pet_name}</div>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Household</div>
                  <div className="text-base font-medium text-foreground">{job.household_name}</div>
                </div>
                
                {/* Contact Info */}
                {job.contact_name && (
                  <div className="pt-4 border-t border-border space-y-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Primary Contact</div>
                    
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{job.contact_name}</span>
                    </div>
                    
                    {job.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${job.contact_phone}`} className="text-sm text-primary hover:underline">
                          {job.contact_phone}
                        </a>
                      </div>
                    )}
                    
                    {job.contact_email && (
                      <div className="flex items-center gap-2">
                        <EnvelopeSimple className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${job.contact_email}`} className="text-sm text-primary hover:underline">
                          {job.contact_email}
                        </a>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/customers?household=${job.household_id}`)}
                  >
                    View Customer Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sidebar - Assignment & Actions */}
          <div className="space-y-6">
            {/* Driver Assignment */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Assignment</h2>
              
              {/* Assignment state. A job can be assigned or reassigned
                  whenever at least one driver exists — including the
                  single-driver case, where a job created while no drivers were
                  configured would otherwise be stuck permanently unassigned. */}
              {activeDriverCount === null ? (
                /* Loading state — activeDriverCount not yet known */
                <div className="bg-muted border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CircleNotch className="h-4 w-4 text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading driver information...</p>
                  </div>
                </div>
              ) : job.assigned_driver_user_id ? (
                /* Assigned — show current assignment, allow reassign if editable */
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Vehicle</div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {job.vehicle_name || 'Assigned'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Driver</div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {users.find(u => u.id === job.assigned_driver_user_id)?.name || 'Driver'}
                      </span>
                    </div>
                  </div>

                  {!isTerminal && activeDriverCount >= 1 && hasPermission('transport', 'update') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAssignDialog(true)}
                    >
                      Reassign
                    </Button>
                  )}
                </div>
              ) : activeDriverCount === 0 ? (
                /* No ACTIVE drivers — distinguish "none exist" from
                   "one exists but is disabled" so the fix is obvious. */
                <div className="bg-muted border border-border rounded-lg p-3">
                  {disabledDrivers.length > 0 ? (
                    <>
                      <p className="text-sm text-foreground mb-1">
                        {disabledDrivers.length === 1
                          ? `${disabledDrivers[0].name} is disabled`
                          : `${disabledDrivers.length} drivers are disabled`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Re-enable {disabledDrivers.length === 1 ? 'them' : 'a driver'} in Staff Management to assign this job.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-1">No drivers configured</p>
                      <p className="text-sm text-muted-foreground">
                        Ask an admin/manager to add drivers in Staff Management before assigning transport jobs.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                /* Unassigned with drivers available — offer assignment */
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-amber-800">This job needs a driver assignment</p>
                  </div>

                  {hasPermission('transport', 'update') && (
                    <Button
                      className="w-full"
                      onClick={() => setShowAssignDialog(true)}
                    >
                      Assign Driver
                    </Button>
                  )}
                </div>
              )}

              {/* Assign Dialog — available whenever at least one driver exists */}
              {showAssignDialog && !!activeDriverCount && activeDriverCount >= 1 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Assign Driver</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Vehicle</label>
                        <select
                          value={selectedVehicleId}
                          onChange={e => setSelectedVehicleId(e.target.value)}
                          className="w-full px-3 py-2 rounded-md border border-border"
                        >
                          <option value="">Select vehicle...</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.licence_plate})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Driver (optional)</label>
                        <select
                          value={selectedDriverId}
                          onChange={e => setSelectedDriverId(e.target.value)}
                          className="w-full px-3 py-2 rounded-md border border-border"
                        >
                          <option value="">Use vehicle's default driver</option>
                          {availableDrivers.map(driver => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Leave blank to use vehicle's default driver</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-6">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowAssignDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleAssignDriver}
                        disabled={!selectedVehicleId}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Actions</h2>
              
              <div className="space-y-3">
                {canStart && (
                  <Button
                    className="w-full"
                    onClick={() => handleStatusUpdate('started')}
                  >
                    <NavigationArrow className="h-4 w-4 mr-2" />
                    Start Job
                  </Button>
                )}
                
                {job.status === 'in_progress' && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleStatusUpdate('arrived')}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Mark Arrived
                    </Button>
                    
                    {(job.direction === 'pickup' || job.direction === 'roundtrip') && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleStatusUpdate('picked_up')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Picked Up
                      </Button>
                    )}
                    
                    {(job.direction === 'dropoff' || job.direction === 'roundtrip') && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleStatusUpdate('dropped_off')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Dropped Off
                      </Button>
                    )}
                  </>
                )}
                
                {canComplete && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusUpdate('completed')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Job
                  </Button>
                )}
                
                {canCancel && (
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    onClick={handleCancelJob}
                  >
                    Cancel Job
                  </Button>
                )}
                
                {/* Message Household */}
                <div className="pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/messages?household=${job.household_id}`)}
                  >
                    <ChatTeardrop className="h-4 w-4 mr-2" />
                    Message Household
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Location Info */}
            <div className="bg-muted rounded-lg border border-border p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Location</div>
              <div className="text-sm text-foreground">{location?.name || 'Unknown'}</div>
            </div>
          </div>
        </div>
      </div>
      {showEditDialog && (
        <EditJobDialog
          job={job}
          onCancel={() => setShowEditDialog(false)}
          onSave={handleSaveEdit}
          saving={isLoading}
        />
      )}
      {confirmDialog}
    </div>
  );
}

// Edit dialog for a scheduled job's mutable fields. Location and the pet/
// household link are intentionally not editable here — delete and recreate to
// change those (keeps the per-location indexes consistent).
function EditJobDialog({
  job,
  onCancel,
  onSave,
  saving,
}: {
  job: TransportJobWithDetails;
  onCancel: () => void;
  onSave: (updates: {
    service_date: string;
    time_window_start: string;
    time_window_end: string;
    address_pickup: string;
    address_dropoff: string;
    notes: string;
  }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    service_date: job.service_date,
    time_window_start: job.time_window_start || '',
    time_window_end: job.time_window_end || '',
    address_pickup: job.address_pickup || '',
    address_dropoff: job.address_dropoff || '',
    notes: job.notes || '',
  });

  const windowInvalid =
    !!form.time_window_start &&
    !!form.time_window_end &&
    form.time_window_start >= form.time_window_end;
  const noAddress = !form.address_pickup.trim() && !form.address_dropoff.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-semibold text-foreground mb-4">Edit Transport Job</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Service Date</label>
            <input
              type="date"
              value={form.service_date}
              onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-border text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Window start</label>
              <TimePicker
                value={form.time_window_start}
                onChange={v => setForm(f => ({ ...f, time_window_start: v }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Window end</label>
              <TimePicker
                value={form.time_window_end}
                onChange={v => setForm(f => ({ ...f, time_window_end: v }))}
              />
            </div>
          </div>
          {windowInvalid && (
            <p className="text-sm text-red-600">End time must be after start time.</p>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Pick-up address</label>
            <textarea
              value={form.address_pickup}
              onChange={e => setForm(f => ({ ...f, address_pickup: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Drop-off address</label>
            <textarea
              value={form.address_dropoff}
              onChange={e => setForm(f => ({ ...f, address_dropoff: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border text-sm resize-none"
            />
          </div>
          {noAddress && (
            <p className="text-sm text-red-600">At least one address is required.</p>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border text-sm resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => onSave(form)}
            disabled={saving || windowInvalid || noAddress}
          >
            {saving ? <CircleNotch className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}