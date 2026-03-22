// Policy Compliance Hook
// Provides compliance checking for blocking policies across the application
// Used to enforce policy acknowledgements before staff can access certain features

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { publicAnonKey, projectId } from '../../../../../utils/supabase/info';

interface BlockingPolicyInfo {
  assignment_id: string;
  policy_id: string;
  policy_version_id: string;
  policy_title?: string;
  due_date: string;
  days_overdue: number;
}

interface ComplianceStatus {
  isBlocked: boolean;
  blockingCount: number;
  blockingPolicies: BlockingPolicyInfo[];
  message: string;
  isLoading: boolean;
  error: string | null;
}

interface ComplianceStats {
  total_policies: number;
  total_assignments: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  due_soon: number;
  blocking_overdue: number;
  completion_rate: number;
}

export function usePolicyCompliance(userId?: string) {
  const [status, setStatus] = useState<ComplianceStatus>({
    isBlocked: false,
    blockingCount: 0,
    blockingPolicies: [],
    message: '',
    isLoading: true,
    error: null,
  });

  const checkCompliance = useCallback(async (targetUserId?: string) => {
    const checkId = targetUserId || userId;
    if (!checkId) {
      setStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/blocking/${checkId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check compliance');
      }

      const data = await response.json();

      setStatus({
        isBlocked: data.is_blocked,
        blockingCount: data.blocking_count,
        blockingPolicies: data.blocking_policies || [],
        message: data.message,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Policy compliance check error:', error);
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    }
  }, [userId]);

  useEffect(() => {
    checkCompliance();
  }, [checkCompliance]);

  return {
    ...status,
    refresh: checkCompliance,
  };
}

export function useComplianceStats() {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/compliance/stats`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch compliance stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Compliance stats error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refresh: fetchStats };
}

// Hook to check if current user can be scheduled (for rota module)
export function useCanBeScheduled() {
  const [canBeScheduled, setCanBeScheduled] = useState(true);
  const [blockingInfo, setBlockingInfo] = useState<BlockingPolicyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSchedulability = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id || !session?.access_token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/blocking/${session.user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-User-Token': `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setCanBeScheduled(!data.is_blocked);
          setBlockingInfo(data.blocking_policies || []);
        }
      } catch (error) {
        console.error('Schedulability check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSchedulability();
  }, []);

  return { canBeScheduled, blockingInfo, isLoading };
}

export default usePolicyCompliance;
