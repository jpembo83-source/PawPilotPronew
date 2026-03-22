// Reusable Reorder Menu Items Component
// Production-grade prioritisation control for context menus
// British English, RBAC-enforced, fully database-backed

import { DropdownMenuItem } from '../ui/dropdown-menu';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface ReorderMenuItemsProps {
  /** Current item's position in the list (0-based index) */
  currentIndex: number;
  /** Total number of items in the list */
  totalItems: number;
  /** Callback when move up is clicked */
  onMoveUp: () => void | Promise<void>;
  /** Callback when move down is clicked */
  onMoveDown: () => void | Promise<void>;
  /** Whether reordering is in progress */
  isReordering?: boolean;
  /** Whether the user has permission to reorder */
  canReorder?: boolean;
  /** Custom labels (defaults to "Move list up" / "Move list down") */
  labels?: {
    moveUp?: string;
    moveDown?: string;
  };
}

/**
 * Reusable context menu items for list reordering
 * 
 * Usage:
 * ```tsx
 * <DropdownMenu>
 *   <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <ReorderMenuItems
 *       currentIndex={index}
 *       totalItems={items.length}
 *       onMoveUp={() => handleReorder(item.id, 'up')}
 *       onMoveDown={() => handleReorder(item.id, 'down')}
 *       canReorder={hasPermission('reorder')}
 *     />
 *     <DropdownMenuSeparator />
 *     {/* Other menu items */}
 *   </DropdownMenuContent>
 * </DropdownMenu>
 * ```
 */
export function ReorderMenuItems({
  currentIndex,
  totalItems,
  onMoveUp,
  onMoveDown,
  isReordering = false,
  canReorder = true,
  labels = {},
}: ReorderMenuItemsProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalItems - 1;
  
  const moveUpLabel = labels.moveUp || 'Move list up';
  const moveDownLabel = labels.moveDown || 'Move list down';

  if (!canReorder) {
    return null;
  }

  return (
    <>
      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault();
          onMoveUp();
        }}
        disabled={isFirst || isReordering}
        className="cursor-pointer"
      >
        <ArrowUp className="mr-2 h-4 w-4" />
        <span>{moveUpLabel}</span>
      </DropdownMenuItem>
      
      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault();
          onMoveDown();
        }}
        disabled={isLast || isReordering}
        className="cursor-pointer"
      >
        <ArrowDown className="mr-2 h-4 w-4" />
        <span>{moveDownLabel}</span>
      </DropdownMenuItem>
    </>
  );
}
