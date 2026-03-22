// Policies Alert Banner - Shows outstanding policy acknowledgements on Dashboard
// Enhanced with blocking policy detection and critical compliance alerts
// Note: This is a BETA feature - only shown to beta testers

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStaffStore } from '../../staff/store';
import { useAuth } from '../../../context/AuthContext';
import { useBetaFeatures } from '../../../hooks/useBetaFeatures';
import { AlertTriangle, X, Shield, FileText, ExternalLink, Clock } from 'lucide-react';

export function PoliciesAlertBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasBetaAccess } = useBetaFeatures();
  const { myPolicies, fetchMyPolicies } = useStaffStore();
  
  // Don't render if user doesn't have beta access (policies is beta feature)
  if (!hasBetaAccess) {
    return null;
  }
  const [dismissed, setDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Fetch for all authenticated users (staff view policies assigned to them)
    const loadPolicies = async () => {
      setIsLoading(true);
      try {
        await fetchMyPolicies();
      } catch (error) {
        // Silently fail - not critical for dashboard
        console.debug('Dashboard policy banner: Failed to fetch policies', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user?.id) {
      loadPolicies();
    }
  }, [user, fetchMyPolicies]);
  
  // Don't show while loading
  if (isLoading) {
    return null;
  }
  
  // Don't show if dismissed
  if (dismissed) {
    return null;
  }
  
  // Calculate outstanding policies
  const outstanding = myPolicies.filter((a: any) => a.status !== 'acknowledged');
  const overdue = myPolicies.filter((a: any) => a.status === 'overdue');
  const blocking = overdue.filter((a: any) => a.is_blocking);
  
  // No banner needed if all policies acknowledged
  if (outstanding.length === 0) {
    return null;
  }
  
  // Critical: Blocking policies overdue - cannot be dismissed
  if (blocking.length > 0) {
    return (
      <div className="relative rounded-lg mb-6 overflow-hidden">
        {/* Critical red banner with animation */}
        <div className="bg-red-600 text-white p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">
                  ⚠️ Critical: Blocking Policies Require Immediate Action
                </h3>
                <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-semibold animate-pulse">
                  URGENT
                </span>
              </div>
              
              <p className="text-sm text-red-100 mt-1">
                You have <strong>{blocking.length}</strong> blocking {blocking.length === 1 ? 'policy' : 'policies'} that are overdue.
                These policies must be acknowledged immediately as they may prevent you from being scheduled for work.
              </p>
              
              {/* List blocking policies */}
              <div className="mt-3 space-y-2">
                {blocking.slice(0, 3).map((policy: any) => (
                  <div 
                    key={policy.id} 
                    className="flex items-center gap-2 text-sm bg-red-500/50 rounded px-3 py-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">{policy.policy_title}</span>
                    <span className="text-red-200">•</span>
                    <span className="text-red-200">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {Math.abs(policy.days_until_due)} {Math.abs(policy.days_until_due) === 1 ? 'day' : 'days'} overdue
                    </span>
                  </div>
                ))}
                {blocking.length > 3 && (
                  <p className="text-sm text-red-200">
                    +{blocking.length - 3} more blocking {blocking.length - 3 === 1 ? 'policy' : 'policies'}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => navigate('/policies')}
                className="mt-4 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Acknowledge Blocking Policies Now
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Progress bar showing compliance */}
        <div className="bg-red-700 h-1">
          <div 
            className="bg-green-400 h-full transition-all"
            style={{ 
              width: `${Math.round(((myPolicies.length - outstanding.length) / myPolicies.length) * 100)}%` 
            }}
          />
        </div>
      </div>
    );
  }
  
  // Standard overdue warning (non-blocking)
  if (overdue.length > 0) {
    return (
      <div className="relative rounded-lg p-4 mb-6 bg-red-50 border border-red-200">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">
              Overdue Policy Acknowledgements
            </h3>
            
            <p className="text-sm text-red-700 mt-1">
              You have <strong>{overdue.length}</strong> overdue {overdue.length === 1 ? 'policy' : 'policies'} that 
              {overdue.length === 1 ? ' requires' : ' require'} your acknowledgement.
            </p>
            
            <button
              onClick={() => navigate('/policies')}
              className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              View Policies
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Pending policies (not yet overdue)
  return (
    <div className="relative rounded-lg p-4 mb-6 bg-amber-50 border border-amber-200">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">
            Outstanding Policy Acknowledgements
          </h3>
          
          <p className="text-sm text-amber-700 mt-1">
            You have <strong>{outstanding.length}</strong> outstanding {outstanding.length === 1 ? 'policy' : 'policies'} to 
            review and acknowledge.
          </p>
          
          <button
            onClick={() => navigate('/policies')}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            View Policies
          </button>
        </div>
      </div>
    </div>
  );
}

export default PoliciesAlertBanner;
