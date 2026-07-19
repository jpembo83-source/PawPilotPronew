/**
 * Driver Dashboard - Production-grade driver view
 * NO SEED/MOCK DATA - Shows only jobs assigned to the logged-in driver
 * British English throughout with strict permission enforcement
 */

import React, { useState, useEffect } from 'react';
import { useTransportStore } from '../store';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { MapPin, NavigationArrow, Warning, CheckCircle, CircleNotch } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Textarea } from '@/app/components/ui/textarea';
import type { TransportJobWithDetails } from '../types';

export function DriverDashboard() {
  const { jobs, isLoading, error, fetchJobs, updateJobStatus } = useTransportStore();
  const { user } = useAuth();
  
  const [activeJob, setActiveJob] = useState<TransportJobWithDetails | null>(null);
  const [actionType, setActionType] = useState<'complete' | 'fail' | null>(null);
  const [note, setNote] = useState('');
  
  const today = format(new Date(), 'yyyy-MM-dd');

  // Which leg is the driver on? Roundtrips collect from the pickup address,
  // then (once picked_up_at is stamped) deliver to the dropoff. Single-leg
  // jobs resolve to their one address.
  const onDropoffLeg = (job: TransportJobWithDetails) =>
    job.direction === 'dropoff' ||
    (job.direction === 'roundtrip' && !!job.picked_up_at);
  
  // Fetch jobs assigned to current driver
  useEffect(() => {
    if (user) {
      fetchJobs({
        driver_user_id: user.id,
        service_date: today
      });
    }
  }, [user, today, fetchJobs]);
  
  // Get my route (jobs assigned to me for today)
  const myJobs = jobs.filter(j => j.assigned_driver_user_id === user?.id);
  const currentJobIndex = myJobs.findIndex(j => j.status === 'scheduled' || j.status === 'in_progress');
  const nextJob = currentJobIndex !== -1 ? myJobs[currentJobIndex] : null;
  const activeRoute = myJobs.find(j => j.status === 'in_progress');
  
  const progress = myJobs.length > 0 
    ? Math.round((myJobs.filter(j => j.status === 'completed').length / myJobs.length) * 100)
    : 0;

  const handleAction = (job: TransportJobWithDetails, type: 'complete' | 'fail') => {
    setActiveJob(job);
    setActionType(type);
    setNote('');
  };

  const confirmAction = async () => {
    if (!activeJob || !actionType) return;

    try {
      // 'complete' on the pickup leg of a roundtrip only finishes that leg
      // (picked_up); otherwise it completes the job. 'fail' reports a failed
      // attempt (distinct from a dispatcher cancellation).
      const isPickupLegOfRoundtrip =
        activeJob.direction === 'roundtrip' && !activeJob.picked_up_at;
      const eventType =
        actionType === 'fail'
          ? 'failed'
          : isPickupLegOfRoundtrip
          ? 'picked_up'
          : 'completed';
      await updateJobStatus(activeJob.id, eventType, note);
      setActiveJob(null);
      setActionType(null);
      setNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update job status');
    }
  };
  
  const handleStartRoute = async () => {
    if (nextJob) {
      try {
        await updateJobStatus(nextJob.id, 'started');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start route');
      }
    }
  };

  // Loading state
  if (isLoading && myJobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <CircleNotch className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading your route...</p>
        </div>
      </div>
    );
  }

  // No jobs assigned
  if (!isLoading && myJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-muted-foreground p-6 text-center">
        <div className="bg-muted p-4 rounded-full mb-4">
          <NavigationArrow className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Active Route</h2>
        <p>You don't have any transport jobs assigned for today yet.</p>
        {error && (
          <div className="mt-4 text-sm text-red-600">
            Error: {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen pb-20">
      {/* Header */}
      <div className="bg-card p-4 border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-lg font-bold text-foreground">Today's Route</h1>
            <div className="flex items-center text-sm text-muted-foreground gap-2">
               <span>{myJobs[0]?.vehicle_name || 'Vehicle'}</span>
               <span className="text-muted-foreground/40">•</span>
               <span>{myJobs.length} {myJobs.length === 1 ? 'Stop' : 'Stops'}</span>
            </div>
          </div>
          <Badge variant={activeRoute ? 'default' : 'secondary'}>
            {activeRoute ? 'In Progress' : 'Not Started'}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2 mt-2">
          <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        
        {!activeRoute && nextJob && (
          <Button className="w-full py-6 text-lg" onClick={handleStartRoute}>
            <NavigationArrow className="mr-2 h-5 w-5" /> Start Route
          </Button>
        )}

        {/* Current Job Card */}
        {activeRoute && nextJob && (
          <div className="bg-card rounded-xl border border-primary/20 shadow-md overflow-hidden ring-2 ring-primary ring-offset-2">
            <div className="bg-primary px-4 py-2 text-primary-foreground text-sm font-medium flex justify-between items-center">
              <span>Next Stop #{currentJobIndex + 1}</span>
              <NavigationArrow className="h-4 w-4" />
            </div>
            <div className="p-5">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-foreground mb-1">{nextJob.pet_name}</h2>
                <p className="text-muted-foreground flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${onDropoffLeg(nextJob) ? 'bg-orange-500' : 'bg-green-500'}`} />
                  {nextJob.direction === 'roundtrip'
                    ? (onDropoffLeg(nextJob) ? 'Round trip — drop off' : 'Round trip — pick up')
                    : nextJob.direction === 'pickup' ? 'Pick up' : 'Drop off'}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground text-lg">
                      {onDropoffLeg(nextJob) ? nextJob.address_dropoff : nextJob.address_pickup}
                    </p>
                    {nextJob.time_window_start && nextJob.time_window_end && (
                      <p className="text-sm text-muted-foreground">
                        Time window: {nextJob.time_window_start} - {nextJob.time_window_end}
                      </p>
                    )}
                  </div>
                </div>
                
                {nextJob.contact_phone && (
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium text-foreground">{nextJob.contact_phone}</p>
                    {nextJob.contact_name && (
                      <p className="text-muted-foreground">{nextJob.contact_name}</p>
                    )}
                  </div>
                )}
                
                {nextJob.notes && (
                  <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm flex gap-2">
                    <Warning className="h-4 w-4 shrink-0 mt-0.5" />
                    {nextJob.notes}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleAction(nextJob, 'fail')}
                >
                  Report Issue
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleAction(nextJob, 'complete')}
                >
                  {onDropoffLeg(nextJob)
                    ? 'Dropped Off'
                    : nextJob.direction === 'roundtrip' ? 'Picked Up' : nextJob.direction === 'pickup' ? 'Picked Up' : 'Dropped Off'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Job List */}
        <div className="space-y-3 mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pl-1">Route Overview</h3>
          {myJobs.map((job, idx) => {
            const isDone = job.status === 'completed';
            const isCancelled = job.status === 'cancelled' || job.status === 'failed';
            const isCurrent = activeRoute && nextJob?.id === job.id;
            
            if (isCurrent) return null; // Already shown above

            return (
              <div key={job.id} className={`bg-card p-4 rounded-lg border ${isDone ? 'border-border opacity-60' : 'border-border'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                      isDone ? 'bg-green-100 text-green-700 border-green-200' :
                      isCancelled ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-muted text-muted-foreground border-border'
                    }`}>
                      {isDone ? <CheckCircle className="h-3 w-3" /> : idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{job.pet_name}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {onDropoffLeg(job) ? job.address_dropoff : job.address_pickup}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {job.direction === 'pickup' ? 'Pick' : 'Drop'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!activeJob} onOpenChange={(open) => !open && setActiveJob(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'complete' ? 'Complete Stop' : 'Report Issue'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
             <Textarea 
               placeholder={actionType === 'complete' ? "Optional notes..." : "Reason for failure (e.g. Customer not home)..."}
               value={note}
               onChange={(e) => setNote(e.target.value)}
             />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveJob(null)}>Cancel</Button>
            <Button 
              variant={actionType === 'fail' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={isLoading}
            >
              {isLoading ? <CircleNotch className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
