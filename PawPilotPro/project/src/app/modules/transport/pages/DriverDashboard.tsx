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

export function DriverDashboard() {
  const { jobs, isLoading, error, fetchJobs, updateJobStatus } = useTransportStore();
  const { session, user } = useAuth();
  
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'complete' | 'fail' | null>(null);
  const [note, setNote] = useState('');
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Fetch jobs assigned to current driver
  useEffect(() => {
    if (session && user) {
      fetchJobs({
        driver_user_id: user.id,
        service_date: today
      });
    }
  }, [session, user, today]);
  
  // Get my route (jobs assigned to me for today)
  const myJobs = jobs.filter(j => j.assigned_driver_user_id === user?.id);
  const currentJobIndex = myJobs.findIndex(j => j.status === 'scheduled' || j.status === 'in_progress');
  const nextJob = currentJobIndex !== -1 ? myJobs[currentJobIndex] : null;
  const activeRoute = myJobs.find(j => j.status === 'in_progress');
  
  const progress = myJobs.length > 0 
    ? Math.round((myJobs.filter(j => j.status === 'completed').length / myJobs.length) * 100)
    : 0;

  const handleAction = (job: any, type: 'complete' | 'fail') => {
    setActiveJob(job);
    setActionType(type);
    setNote('');
  };

  const confirmAction = async () => {
    if (!activeJob || !actionType) return;
    
    try {
      const eventType = actionType === 'complete' ? 'completed' : 'cancelled';
      await updateJobStatus(activeJob.id, eventType, note);
      setActiveJob(null);
      setActionType(null);
      setNote('');
    } catch (err) {
      console.error('Failed to update job status:', err);
      toast.error('Failed to update job status. Please try again.');
    }
  };
  
  const handleStartRoute = async () => {
    if (nextJob) {
      try {
        await updateJobStatus(nextJob.id, 'started');
      } catch (err) {
        console.error('Failed to start route:', err);
        toast.error('Failed to start route. Please try again.');
      }
    }
  };

  // Loading state
  if (isLoading && myJobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <CircleNotch className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
          <p className="text-slate-500">Loading your route...</p>
        </div>
      </div>
    );
  }

  // No jobs assigned
  if (!isLoading && myJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500 p-6 text-center">
        <div className="bg-slate-100 p-4 rounded-full mb-4">
          <NavigationArrow className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No Active Route</h2>
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
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white p-4 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Today's Route</h1>
            <div className="flex items-center text-sm text-slate-500 gap-2">
               <span>{myJobs[0]?.vehicle_name || 'Vehicle'}</span>
               <span className="text-slate-300">•</span>
               <span>{myJobs.length} {myJobs.length === 1 ? 'Stop' : 'Stops'}</span>
            </div>
          </div>
          <Badge variant={activeRoute ? 'default' : 'secondary'}>
            {activeRoute ? 'In Progress' : 'Not Started'}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
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
          <div className="bg-white rounded-xl border border-blue-100 shadow-md overflow-hidden ring-2 ring-blue-500 ring-offset-2">
            <div className="bg-blue-600 px-4 py-2 text-white text-sm font-medium flex justify-between items-center">
              <span>Next Stop #{currentJobIndex + 1}</span>
              <NavigationArrow className="h-4 w-4" />
            </div>
            <div className="p-5">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{nextJob.pet_name}</h2>
                <p className="text-slate-600 flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${nextJob.direction === 'pickup' ? 'bg-green-500' : 'bg-orange-500'}`} />
                  {nextJob.direction === 'pickup' ? 'Pick up' : nextJob.direction === 'dropoff' ? 'Drop off' : 'Round trip'}
                </p>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900 text-lg">
                      {nextJob.direction === 'pickup' ? nextJob.address_pickup : nextJob.address_dropoff}
                    </p>
                    {nextJob.time_window_start && nextJob.time_window_end && (
                      <p className="text-sm text-slate-500">
                        Time window: {nextJob.time_window_start} - {nextJob.time_window_end}
                      </p>
                    )}
                  </div>
                </div>
                
                {nextJob.contact_phone && (
                  <div className="bg-slate-50 p-3 rounded-md text-sm">
                    <p className="text-slate-500">Contact</p>
                    <p className="font-medium text-slate-900">{nextJob.contact_phone}</p>
                    {nextJob.contact_name && (
                      <p className="text-slate-600">{nextJob.contact_name}</p>
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
                  {nextJob.direction === 'pickup' ? 'Picked Up' : 'Dropped Off'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Job List */}
        <div className="space-y-3 mt-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider pl-1">Route Overview</h3>
          {myJobs.map((job, idx) => {
            const isDone = job.status === 'completed';
            const isCancelled = job.status === 'cancelled';
            const isCurrent = activeRoute && nextJob?.id === job.id;
            
            if (isCurrent) return null; // Already shown above

            return (
              <div key={job.id} className={`bg-white p-4 rounded-lg border ${isDone ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                      isDone ? 'bg-green-100 text-green-700 border-green-200' :
                      isCancelled ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {isDone ? <CheckCircle className="h-3 w-3" /> : idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{job.pet_name}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[150px]">
                        {job.direction === 'pickup' ? job.address_pickup : job.address_dropoff}
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
