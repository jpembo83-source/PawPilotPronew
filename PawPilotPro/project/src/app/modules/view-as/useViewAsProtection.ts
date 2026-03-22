// View As Protection Hook - MDC Operations Centre
// Provides utilities to disable/block actions when in View As mode

import { useCallback } from 'react';
import { useViewAs } from '../../context/ViewAsContext';
import { toast } from 'sonner';

export function useViewAsProtection() {
  const { isViewingAs, validateAction } = useViewAs();

  /**
   * Blocks an action if in View As mode
   * @param actionType - Type of action being attempted (e.g., 'create_booking', 'update_customer')
   * @returns true if action is allowed, false if blocked
   */
  const checkAction = useCallback(async (actionType: string): Promise<boolean> => {
    if (!isViewingAs) {
      return true; // Not in View As mode, allow action
    }

    const allowed = await validateAction(actionType);
    
    if (!allowed) {
      toast.error('This action is disabled in View As mode', {
        description: 'You can only view data when using View As',
      });
    }

    return allowed;
  }, [isViewingAs, validateAction]);

  /**
   * Wraps a callback to prevent execution in View As mode
   */
  const protectAction = useCallback(<T extends (...args: any[]) => any>(
    actionType: string,
    callback: T
  ): ((...args: Parameters<T>) => Promise<ReturnType<T> | void>) => {
    return async (...args: Parameters<T>) => {
      const allowed = await checkAction(actionType);
      if (allowed) {
        return callback(...args);
      }
    };
  }, [checkAction]);

  /**
   * Returns true if currently in View As mode
   */
  const isReadOnly = isViewingAs;

  return {
    isViewingAs,
    isReadOnly,
    checkAction,
    protectAction,
  };
}
