// Reorder Hook - Client-side reordering logic
// Production-grade hook for managing list reordering state and API calls

import { useState } from 'react';
import { toast } from 'sonner';

interface ReorderOptions {
  /** API endpoint for reordering (e.g., '/api/widgets/reorder') */
  endpoint: string;
  /** Auth token for API requests */
  getAuthToken: () => Promise<string>;
  /** Callback after successful reorder */
  onSuccess?: () => void;
  /** Custom error message */
  errorMessage?: string;
}

export interface ReorderItem {
  id: string;
  sort_order: number;
  [key: string]: any;
}

/**
 * Reusable hook for list reordering with optimistic updates and rollback
 * 
 * @example
 * ```tsx
 * const { reorder, isReordering } = useReorder({
 *   endpoint: '/api/dashboard/widgets/reorder',
 *   getAuthToken: async () => (await supabase.auth.getSession()).data.session?.access_token || '',
 *   onSuccess: () => refetchWidgets(),
 * });
 * 
 * await reorder(widget.id, 'up', widgets, setWidgets);
 * ```
 */
export function useReorder(options: ReorderOptions) {
  const [isReordering, setIsReordering] = useState(false);

  const reorder = async <T extends ReorderItem>(
    itemId: string,
    direction: 'up' | 'down',
    currentItems: T[],
    setItems: (items: T[]) => void
  ): Promise<boolean> => {
    if (isReordering) return false;

    setIsReordering(true);

    // Find current item
    const currentIndex = currentItems.findIndex(item => item.id === itemId);
    if (currentIndex === -1) {
      console.error('Item not found in list');
      setIsReordering(false);
      return false;
    }

    // Boundary checks
    if (direction === 'up' && currentIndex === 0) {
      setIsReordering(false);
      return false;
    }
    if (direction === 'down' && currentIndex === currentItems.length - 1) {
      setIsReordering(false);
      return false;
    }

    // Store original order for rollback
    const originalItems = [...currentItems];

    // Optimistic update: swap items
    const newItems = [...currentItems];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newItems[currentIndex], newItems[targetIndex]] = [newItems[targetIndex], newItems[currentIndex]];

    // Update sort_order values
    newItems.forEach((item, index) => {
      item.sort_order = index + 1;
    });

    // Apply optimistic update
    setItems(newItems);

    try {
      // Call API
      const token = await options.getAuthToken();
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          direction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Reorder failed');
      }

      // Success
      options.onSuccess?.();
      return true;

    } catch (error: any) {
      console.error('Reorder error:', error);
      
      // Rollback optimistic update
      setItems(originalItems);
      
      toast.error(
        options.errorMessage || 'Failed to update order',
        { description: error.message }
      );
      
      return false;
    } finally {
      setIsReordering(false);
    }
  };

  return {
    reorder,
    isReordering,
  };
}
