/**
 * Transport Job Detail - Operational execution view
 * Shows full job details and allows status progression
 * British English throughout, production-grade, no mock data
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTransportStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { useUserStore } from '../../settings/stores/userStore';
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
  const { confirm, confirmDialog } = useConfirmDialog();
  
  // Debug: Log activeDriverCount whenever it changes
  useEffect(() => {
    console.log('[JobDetail] activeDriverCount changed to:', activeDriverCount);
  }, [activeDriverCount]);
  
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  
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
  
  const handleStatusUpdate = async (eventType: string) => {
    if (!job) return;
    
    try {
      await updateJobStatus(job.id, eventType, actionNotes || undefined);
      setActionNotes('');
      toast.success(`Job status updated to ${eventType}`);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };
  
  const handleAssignDriver = async () => {
    if (!job || !selectedVehicleId) return;
    
    try {
      // Pass undefined if no driver selected (empty string), otherwise pass the selected driver ID
      const driverToAssign = selectedDriverId.trim() || undefined;
      await assignDriver(job.id, driverToAssign, selectedVehicleId);
      setShowAssignDialog(false);
      setSelectedDriverId('');
      setSelectedVehicleId('');
      toast.success('Driver assigned successfully');
    } catch (err) {
      console.error('Failed to assign driver:', err);
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
          <CircleNotch className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
          <p className="text-slate-500">Loading job details...</p>
        </div>
      </div>
    );
  }
  
  if (error || !job) {
    return (
      <div className="h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <Warning className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Job Not Found</h3>
          <p className="text-slate-500 mb-4">
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
  const statusColors = {
    scheduled: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-teal-100 text-teal-700',
    cancelled: 'bg-red-100 text-red-700'
  };
  
  const canStart = job.status === 'scheduled' && job.assigned_driver_user_id;
  const canComplete = job.status === 'in_progress';
  const canCancel = job.status !== 'completed' && job.status !== 'cancelled';
  
  return (
    <div className="h-[calc(100vh-100px)] overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={goBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Transport Job Details</h1>
              <p className="text-slate-500">Job #{job.id.slice(0, 12)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={statusColors[job.status]} variant="secondary">
              {job.status.replace('_', ' ')}
            </Badge>
            {job.status === 'scheduled' && (
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
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Information</h2>
              
              <div className="space-y-4">
                {/* Date & Time */}
                <div className="flex items-start gap-3">
                  <CalendarBlank className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {format(new Date(job.service_date), 'EEEE, MMMM d, yyyy')}
                    </div>
                    {job.time_window_start && job.time_window_end && (
                      <div className="text-sm text-slate-500 mt-1">
                        {job.time_window_start} - {job.time_window_end}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Direction */}
                <div className="flex items-start gap-3">
                  <NavigationArrow className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-slate-900 capitalize">
                      {job.direction === 'roundtrip' ? 'Round Trip' : job.direction}
                    </div>
                  </div>
                </div>
                
                {/* Pickup Address */}
                {job.address_pickup && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pick-up</div>
                      <div className="text-sm text-slate-900 mt-1">{job.address_pickup}</div>
                    </div>
                  </div>
                )}
                
                {/* Dropoff Address */}
                {job.address_dropoff && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Drop-off</div>
                      <div className="text-sm text-slate-900 mt-1">{job.address_dropoff}</div>
                    </div>
                  </div>
                )}
                
                {/* Notes */}
                {job.notes && (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Notes</div>
                    <div className="text-sm text-slate-700">{job.notes}</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Pet & Household */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Pet & Household</h2>
              
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Pet</div>
                  <div className="text-base font-medium text-slate-900">{job.pet_name}</div>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Household</div>
                  <div className="text-base font-medium text-slate-900">{job.household_name}</div>
                </div>
                
                {/* Contact Info */}
                {job.contact_name && (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Primary Contact</div>
                    
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-900">{job.contact_name}</span>
                    </div>
                    
                    {job.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <a href={`tel:${job.contact_phone}`} className="text-sm text-blue-600 hover:underline">
                          {job.contact_phone}
                        </a>
                      </div>
                    )}
                    
                    {job.contact_email && (
                      <div className="flex items-center gap-2">
                        <EnvelopeSimple className="h-4 w-4 text-slate-400" />
                        <a href={`mailto:${job.contact_email}`} className="text-sm text-blue-600 hover:underline">
                          {job.contact_email}
                        </a>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-200">
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
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Assignment</h2>
              
              {/* Conditional rendering based on driver count */}
              {activeDriverCount === 1 ? (
                /* RULE B: Single driver - show read-only assignment OR unassigned state */
                job.assigned_driver_user_id ? (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <p className="text-xs text-blue-700">Auto-assigned to sole driver</p>
                    </div>
                    
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Vehicle</div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-900">
                          {job.vehicle_name || 'Assigned'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Driver</div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-900">
                          {users.find(u => u.id === job.assigned_driver_user_id)?.name || 'Driver'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single driver but not yet assigned - show message */
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800 mb-1">Ready for auto-assignment</p>
                    <p className="text-xs text-blue-600">
                      This job will be automatically assigned to your sole driver when created.
                    </p>
                  </div>
                )
              ) : activeDriverCount && activeDriverCount >= 2 ? (
                /* RULE C: Multiple drivers - show assignment controls */
                job.assigned_driver_user_id ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Vehicle</div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-900">
                          {job.vehicle_name || 'Assigned'}
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAssignDialog(true)}
                    >
                      Reassign
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-amber-800">This job needs a driver assignment</p>
                    </div>
                    
                    <Button
                      className="w-full"
                      onClick={() => setShowAssignDialog(true)}
                    >
                      Assign Driver
                    </Button>
                  </div>
                )
              ) : activeDriverCount === 0 ? (
                /* RULE A: No drivers configured */
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-sm text-slate-600 mb-1">No drivers configured</p>
                  <p className="text-xs text-slate-500">
                    Ask an admin/manager to add drivers in Staff Management before assigning transport jobs.
                  </p>
                </div>
              ) : (
                /* Loading state - activeDriverCount is null */
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CircleNotch className="h-4 w-4 text-slate-400 animate-spin" />
                    <p className="text-sm text-slate-600">Loading driver information...</p>
                  </div>
                </div>
              )}
              
              {/* Assign Dialog - Only shown if activeDriverCount >= 2 */}
              {showAssignDialog && activeDriverCount && activeDriverCount >= 2 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Assign Driver</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Vehicle</label>
                        <select
                          value={selectedVehicleId}
                          onChange={e => setSelectedVehicleId(e.target.value)}
                          className="w-full px-3 py-2 rounded-md border border-slate-200"
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
                        <label className="block text-sm font-medium text-slate-700 mb-2">Driver (optional)</label>
                        <select
                          value={selectedDriverId}
                          onChange={e => setSelectedDriverId(e.target.value)}
                          className="w-full px-3 py-2 rounded-md border border-slate-200"
                        >
                          <option value="">Use vehicle's default driver</option>
                          {availableDrivers.map(driver => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Leave blank to use vehicle's default driver</p>
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
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Actions</h2>
              
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
                    onClick={() => {
                      const reason = prompt('Cancellation reason:');
                      if (reason) {
                        handleStatusUpdate('cancelled');
                      }
                    }}
                  >
                    Cancel Job
                  </Button>
                )}
                
                {/* Message Household */}
                <div className="pt-3 border-t border-slate-200">
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
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Location</div>
              <div className="text-sm text-slate-900">{location?.name || 'Unknown'}</div>
            </div>
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}