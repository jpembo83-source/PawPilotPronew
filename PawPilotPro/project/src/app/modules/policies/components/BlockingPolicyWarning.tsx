// Blocking Policy Warning Component
// Displays a prominent warning when staff have overdue blocking policies
// Can be used as a banner or inline alert throughout the application

import React from 'react';
import { Warning, FileText, Clock, ArrowSquareOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { usePolicyCompliance } from '../hooks/usePolicyCompliance';

interface BlockingPolicyWarningProps {
  userId?: string;
  variant?: 'banner' | 'inline' | 'compact';
  showNavigateButton?: boolean;
  className?: string;
}

export function BlockingPolicyWarning({
  userId,
  variant = 'banner',
  showNavigateButton = true,
  className = '',
}: BlockingPolicyWarningProps) {
  const { isBlocked, blockingCount, blockingPolicies, isLoading, message } = usePolicyCompliance(userId);
  const navigate = useNavigate();

  // Don't render if not blocked or still loading
  if (isLoading || !isBlocked) {
    return null;
  }

  const handleNavigate = () => {
    navigate('/staff/policies');
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-red-600 ${className}`}>
        <Warning className="w-4 h-4" />
        <span className="text-sm font-medium">
          {blockingCount} blocking {blockingCount === 1 ? 'policy' : 'policies'} overdue
        </span>
        {showNavigateButton && (
          <button
            onClick={handleNavigate}
            className="text-sm underline hover:no-underline"
          >
            View
          </button>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Warning className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900">
              Action Required: Overdue Policies
            </h4>
            <p className="text-sm text-red-700 mt-1">
              You have {blockingCount} overdue {blockingCount === 1 ? 'policy' : 'policies'} that 
              must be acknowledged before you can continue working.
            </p>
            {showNavigateButton && (
              <button
                onClick={handleNavigate}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
              >
                Go to My Policies
                <ArrowSquareOut className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner variant (default)
  return (
    <div className={`bg-red-600 text-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Warning className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">
                ⚠️ Compliance Action Required
              </p>
              <p className="text-sm text-red-100">
                You have {blockingCount} overdue blocking {blockingCount === 1 ? 'policy' : 'policies'} that 
                must be acknowledged immediately.
              </p>
            </div>
          </div>
          
          {showNavigateButton && (
            <button
              onClick={handleNavigate}
              className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Acknowledge Now
            </button>
          )}
        </div>
        
        {blockingPolicies.length > 0 && (
          <div className="mt-3 pt-3 border-t border-red-500">
            <p className="text-sm text-red-100 mb-2">Overdue policies:</p>
            <div className="flex flex-wrap gap-2">
              {blockingPolicies.map((policy) => (
                <div
                  key={policy.assignment_id}
                  className="bg-red-500 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  <Clock className="w-3 h-3" />
                  <span>
                    {policy.policy_title || 'Policy'} • {policy.days_overdue} {policy.days_overdue === 1 ? 'day' : 'days'} overdue
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Smaller badge for use in staff lists and profiles
export function BlockingPolicyBadge({ userId }: { userId: string }) {
  const { isBlocked, blockingCount, isLoading } = usePolicyCompliance(userId);

  if (isLoading || !isBlocked) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-medium">
      <Warning className="w-3 h-3" />
      {blockingCount} blocking
    </span>
  );
}

// Widget for dashboard use
export function BlockingPolicyWidget() {
  const { isBlocked, blockingCount, blockingPolicies, isLoading, message } = usePolicyCompliance();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (!isBlocked) {
    return (
      <div className="bg-white border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-slate-600">Policy Compliance</p>
            <p className="text-lg font-semibold text-green-600">All policies acknowledged</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Warning className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-red-600">Blocking Policies Overdue</p>
            <p className="text-2xl font-bold text-red-700">{blockingCount}</p>
            <p className="text-sm text-red-600 mt-1">
              {blockingCount === 1 ? 'This policy requires' : 'These policies require'} immediate acknowledgement
            </p>
          </div>
        </div>
        
        <button
          onClick={() => navigate('/staff/policies')}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          View Policies
        </button>
      </div>
      
      {blockingPolicies.length > 0 && (
        <div className="mt-4 pt-4 border-t border-red-200 space-y-2">
          {blockingPolicies.slice(0, 3).map((policy) => (
            <div key={policy.assignment_id} className="flex items-center justify-between text-sm">
              <span className="text-red-700">{policy.policy_title || `Policy ${policy.policy_id}`}</span>
              <span className="text-red-600 font-medium">{policy.days_overdue}d overdue</span>
            </div>
          ))}
          {blockingPolicies.length > 3 && (
            <p className="text-sm text-red-600">
              +{blockingPolicies.length - 3} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BlockingPolicyWarning;
