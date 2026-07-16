/**
 * Driver Mobile View - Optimised for use while driving
 * 
 * Design principles:
 * - LARGE touch targets (min 60px)
 * - High contrast colours
 * - One-handed operation
 * - Minimal text, maximum clarity
 * - One-tap navigation
 * - Swipe to complete
 * - Auto-refresh route status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTransportStore } from '../store';
import { useAuth } from '@/app/context/AuthContext';
import { 
  NavigationArrow, 
  Phone, 
  CheckCircle, 
  XCircle, 
  CaretUp, 
  CaretDown,
  MapPin,
  Clock,
  Warning,
  CircleNotch,
  Car,
  ArrowRight,
  ArrowClockwise
} from '@phosphor-icons/react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Status colours - high contrast for visibility. Keyed by the leg the driver
// is on (roundtrip resolves to its pickup or dropoff leg before lookup).
const STATUS_COLOURS = {
  pickup: { bg: 'bg-emerald-500', text: 'text-white', label: 'PICK UP' },
  dropoff: { bg: 'bg-orange-500', text: 'text-white', label: 'DROP OFF' },
};

interface DriverMobileViewProps {
  onExit?: () => void;
}

export function DriverMobileView({ onExit }: DriverMobileViewProps) {
  const { jobs, isLoading, fetchJobs, updateJobStatus } = useTransportStore();
  const { user } = useAuth();
  
  const [showRouteList, setShowRouteList] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [issueNote, setIssueNote] = useState('');
  const [actionPending, setActionPending] = useState<'complete' | 'issue' | null>(null);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Fetch and refresh jobs
  const refreshJobs = useCallback(() => {
    if (user) {
      fetchJobs({
        driver_user_id: user.id,
        service_date: today
      });
    }
  }, [user, today, fetchJobs]);

  useEffect(() => {
    refreshJobs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshJobs, 30000);
    return () => clearInterval(interval);
  }, [refreshJobs]);
  
  // Filter jobs for this driver
  const myJobs = jobs.filter(j => j.assigned_driver_user_id === user?.id);
  const completedCount = myJobs.filter(j => j.status === 'completed').length;
  const totalCount = myJobs.length;
  
  // Find current/next job
  const pendingJobs = myJobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress');
  const currentJob = pendingJobs[0];
  const nextJob = pendingJobs[1];
  const isRouteActive = myJobs.some(j => j.status === 'in_progress');

  // A roundtrip is two legs on one job: collect from the pickup address, then
  // deliver to the dropoff. picked_up_at (stamped server-side) marks leg 1
  // done. pickup/dropoff jobs are always a single leg.
  const onDropoffLeg =
    currentJob?.direction === 'dropoff' ||
    (currentJob?.direction === 'roundtrip' && !!currentJob?.picked_up_at);

  const currentAddress = onDropoffLeg
    ? currentJob?.address_dropoff
    : currentJob?.address_pickup;

  // The primary action either finishes the pickup leg of a roundtrip
  // (picked_up, job stays in progress) or completes the job.
  const isPickupLegOfRoundtrip =
    currentJob?.direction === 'roundtrip' && !currentJob?.picked_up_at;
  const primaryActionLabel = isPickupLegOfRoundtrip ? 'PICKED UP' : 'DONE';

  // Handle complete / advance-leg action
  const handleComplete = async () => {
    if (!currentJob) return;
    setActionPending('complete');
    try {
      await updateJobStatus(currentJob.id, isPickupLegOfRoundtrip ? 'picked_up' : 'completed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update stop');
    }
    setActionPending(null);
  };

  // Open the issue note sheet
  const handleIssue = () => setShowIssueDialog(true);

  // Called after driver writes their note and confirms
  const handleIssueConfirm = async () => {
    if (!currentJob) return;
    const jobId = currentJob.id; // capture before any state changes
    setActionPending('issue');
    try {
      // 'failed' (attempted but unsuccessful), not 'cancelled' (dispatcher
      // decision) — a failed stop stays visible and can be re-scheduled.
      await updateJobStatus(jobId, 'failed', issueNote.trim() || 'Issue reported by driver');
      setShowIssueDialog(false);
      setIssueNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to report issue');
    }
    setActionPending(null);
  };

  // Start route
  const handleStartRoute = async () => {
    if (!currentJob) return;
    setActionPending('complete');
    try {
      await updateJobStatus(currentJob.id, 'started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start route');
    }
    setActionPending(null);
  };

  // Open navigation app
  const openNavigation = (address: string) => {
    const encoded = encodeURIComponent(address);
    // Try Apple Maps first on iOS, fallback to Google Maps
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.open(`maps://maps.apple.com/?daddr=${encoded}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
    }
  };

  // Make phone call
  const makeCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  // Loading state
  if (isLoading && myJobs.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <CircleNotch className="h-16 w-16 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-xl">Loading your route...</p>
        </div>
      </div>
    );
  }

  // No jobs state
  if (!isLoading && myJobs.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800 p-8 rounded-3xl text-center max-w-sm">
          <Car className="h-20 w-20 text-slate-600 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">No Route Today</h1>
          <p className="text-slate-400 mb-6">You don't have any stops assigned yet.</p>
          <button 
            onClick={refreshJobs}
            className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl text-lg font-semibold active:bg-blue-700"
          >
            <ArrowClockwise className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // All complete state
  if (pendingJobs.length === 0 && completedCount === totalCount) {
    return (
      <div className="fixed inset-0 bg-emerald-600 flex flex-col items-center justify-center p-6">
        <CheckCircle className="h-32 w-32 text-white mb-6" />
        <h1 className="text-4xl font-bold text-white mb-2">Route Complete!</h1>
        <p className="text-emerald-100 text-xl mb-8">{completedCount} stops completed</p>
        <button 
          onClick={refreshJobs}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-600 rounded-2xl text-lg font-semibold active:bg-emerald-50"
        >
          <ArrowClockwise className="h-5 w-5" />
          Check for Updates
        </button>
      </div>
    );
  }

  // currentAddress and the leg flags are computed above (roundtrip-aware).
  const statusConfig = onDropoffLeg ? STATUS_COLOURS.dropoff : STATUS_COLOURS.pickup;

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between shrink-0 safe-area-top">
        <div className="flex items-center gap-3">
          <div className="bg-slate-700 px-3 py-1 rounded-full">
            <span className="text-white font-bold">{completedCount}/{totalCount}</span>
          </div>
          <span className="text-slate-400 text-sm">stops</span>
        </div>
        
        {/* Progress dots */}
        <div className="flex gap-1">
          {myJobs.map((job, i) => (
            <div 
              key={job.id}
              className={`h-2 w-2 rounded-full ${
                job.status === 'completed' ? 'bg-emerald-500' :
                job.status === 'failed' ? 'bg-orange-400' :
                job.status === 'cancelled' ? 'bg-red-500' :
                job.status === 'in_progress' ? 'bg-blue-500' :
                'bg-slate-600'
              }`}
            />
          ))}
        </div>

        <button 
          onClick={refreshJobs}
          className="p-2 text-slate-400 active:text-white"
          disabled={isLoading}
        >
          <ArrowClockwise className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        
        {/* Current Stop Card */}
        <div className="bg-slate-800 rounded-3xl overflow-hidden flex-1 flex flex-col">
          
          {/* Stop Type Header */}
          <div className={`${statusConfig.bg} px-6 py-4 flex items-center justify-between`}>
            <div>
              <p className={`${statusConfig.text} text-sm font-medium opacity-80`}>
                STOP {completedCount + 1}
              </p>
              <p className={`${statusConfig.text} text-2xl font-bold`}>
                {statusConfig.label}
              </p>
            </div>
            {currentJob?.time_window_start && (
              <div className="bg-white/20 px-4 py-2 rounded-xl">
                <div className="flex items-center gap-2 text-white">
                  <Clock className="h-5 w-5" />
                  <span className="font-bold">{currentJob.time_window_start}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pet & Customer Info */}
          <div className="px-6 py-5 border-b border-slate-700">
            <h2 className="text-3xl font-bold text-white mb-1">
              {currentJob?.pet_name || 'Unknown'}
            </h2>
            {currentJob?.contact_name && (
              <p className="text-slate-400 text-lg">{currentJob.contact_name}</p>
            )}
          </div>

          {/* Address */}
          <div className="px-6 py-4 flex-1">
            <div className="flex items-start gap-3">
              <MapPin className="h-6 w-6 text-slate-500 mt-1 shrink-0" />
              <p className="text-white text-xl leading-relaxed">
                {currentAddress || 'No address'}
              </p>
            </div>
            
            {/* Notes Alert */}
            {currentJob?.notes && (
              <div className="mt-4 bg-amber-500/20 border border-amber-500/30 rounded-2xl p-4 flex gap-3">
                <Warning className="h-6 w-6 text-amber-400 shrink-0" />
                <p className="text-amber-200 text-lg">{currentJob.notes}</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="px-6 py-4 bg-slate-800/50 flex gap-3">
            {/* Navigate Button - Large */}
            <button
              onClick={() => currentAddress && openNavigation(currentAddress)}
              className="flex-1 bg-blue-600 active:bg-blue-700 text-white rounded-2xl py-5 flex items-center justify-center gap-3 text-xl font-semibold"
            >
              <NavigationArrow className="h-7 w-7" />
              Navigate
            </button>

            {/* Call or email — show whichever contact info is available */}
            {currentJob?.contact_phone ? (
              <button
                onClick={() => makeCall(currentJob!.contact_phone!)}
                className="bg-slate-700 active:bg-slate-600 text-white rounded-2xl px-6 py-5 flex items-center justify-center"
                aria-label="Call customer"
              >
                <Phone className="h-7 w-7" />
              </button>
            ) : currentJob?.contact_email ? (
              <a
                href={`mailto:${currentJob.contact_email}`}
                className="bg-slate-700 active:bg-slate-600 text-white rounded-2xl px-6 py-5 flex items-center justify-center"
                aria-label="Email customer"
              >
                <Phone className="h-7 w-7 opacity-60" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Next Stop Preview */}
        {nextJob && (
          <button 
            onClick={() => setShowRouteList(true)}
            className="mt-3 bg-slate-800/50 rounded-2xl p-4 flex items-center gap-4 w-full active:bg-slate-800"
          >
            <div className="bg-slate-700 h-12 w-12 rounded-xl flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-slate-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-slate-500 text-sm">NEXT</p>
              <p className="text-white font-semibold">{nextJob.pet_name}</p>
            </div>
            <CaretUp className="h-6 w-6 text-slate-500" />
          </button>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="p-4 bg-slate-900 safe-area-bottom">
        {!isRouteActive ? (
          /* Start Route Button */
          <button
            onClick={handleStartRoute}
            disabled={actionPending !== null}
            className="w-full bg-emerald-500 active:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl py-6 text-2xl font-bold flex items-center justify-center gap-3"
          >
            {actionPending ? (
              <CircleNotch className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <NavigationArrow className="h-8 w-8" />
                START ROUTE
              </>
            )}
          </button>
        ) : (
          /* Complete / Issue Buttons */
          <div className="flex gap-3">
            <button
              onClick={handleIssue}
              disabled={actionPending !== null}
              className="flex-1 bg-red-500/20 border-2 border-red-500 active:bg-red-500/40 disabled:opacity-50 text-red-400 rounded-2xl py-5 text-lg font-bold flex items-center justify-center gap-2"
            >
              {actionPending === 'issue' ? (
                <CircleNotch className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-6 w-6" />
                  ISSUE
                </>
              )}
            </button>
            <button
              onClick={handleComplete}
              disabled={actionPending !== null}
              className="flex-[2] bg-emerald-500 active:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl py-5 text-xl font-bold flex items-center justify-center gap-3"
            >
              {actionPending === 'complete' ? (
                <CircleNotch className="h-7 w-7 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-7 w-7" />
                  {primaryActionLabel}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Issue Note Bottom Sheet */}
      {showIssueDialog && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-slate-800 w-full rounded-t-3xl p-6 pb-10 safe-area-bottom">
            <h3 className="text-xl font-bold text-white mb-1">Report Issue</h3>
            <p className="text-slate-400 text-sm mb-4">Describe what happened so the manager can follow up.</p>
            <textarea
              value={issueNote}
              onChange={e => setIssueNote(e.target.value)}
              placeholder="e.g. Customer not home, dog was aggressive, wrong address…"
              className="w-full bg-slate-700 text-white rounded-2xl p-4 text-lg resize-none outline-none placeholder:text-slate-500 border-0"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowIssueDialog(false); setIssueNote(''); }}
                className="flex-1 bg-slate-700 active:bg-slate-600 text-white rounded-2xl py-4 text-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueConfirm}
                disabled={actionPending !== null}
                className="flex-[2] bg-red-500 active:bg-red-600 disabled:opacity-50 text-white rounded-2xl py-4 text-xl font-bold flex items-center justify-center gap-2"
              >
                {actionPending === 'issue'
                  ? <CircleNotch className="h-6 w-6 animate-spin" />
                  : 'Confirm Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route List Drawer */}
      {showRouteList && (
        <div 
          className="fixed inset-0 bg-black/60 z-50"
          onClick={() => setShowRouteList(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-slate-800 rounded-t-3xl max-h-[70vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Today's Route</h3>
              <button 
                onClick={() => setShowRouteList(false)}
                className="p-2 text-slate-400"
              >
                <CaretDown className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-auto max-h-[60vh] p-4 space-y-3">
              {myJobs.map((job, idx) => {
                const isDone = job.status === 'completed';
                const isFailed = job.status === 'failed' || job.status === 'cancelled';
                const isCurrent = job.id === currentJob?.id;
                
                return (
                  <div 
                    key={job.id}
                    className={`p-4 rounded-2xl flex items-center gap-4 ${
                      isCurrent ? 'bg-blue-600' :
                      isDone ? 'bg-slate-700/50' :
                      isFailed ? 'bg-red-900/30' :
                      'bg-slate-700'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold ${
                      isDone ? 'bg-emerald-500 text-white' :
                      isFailed ? 'bg-red-500 text-white' :
                      isCurrent ? 'bg-white text-blue-600' :
                      'bg-slate-600 text-white'
                    }`}>
                      {isDone ? <CheckCircle className="h-5 w-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${isCurrent ? 'text-white' : isDone ? 'text-slate-400' : 'text-white'}`}>
                        {job.pet_name}
                      </p>
                      <p className={`text-sm truncate ${isCurrent ? 'text-blue-200' : 'text-slate-500'}`}>
                        {job.direction === 'pickup' ? job.address_pickup : job.address_dropoff}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      job.direction === 'pickup' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {job.direction === 'pickup' ? 'PICK' : 'DROP'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
