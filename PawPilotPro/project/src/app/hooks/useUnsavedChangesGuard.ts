// Reusable unsaved-changes guard for modals and multi-step flows — extracted
// from the inline AlertDialog pattern EditPetModal/EditContactModal carried.
//
// Contract:
// - "Dirty" means current values DIFFER from initial values (use formIsDirty),
//   not merely "a field was touched" — typing and reverting is not dirty.
// - The default/focused action is "Keep editing" (useConfirmDialog focuses the
//   cancel action, so Enter and Escape both keep editing); "Discard" is the
//   destructive action.
// - Route EVERY dismissal path (Cancel button, overlay click, Escape) through
//   requestClose so a dirty form is always guarded:
//     <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) void requestClose(); }}>
//   and render {guardDialog} in the component's JSX.

import { useCallback } from 'react';
import { useConfirmDialog } from './useConfirmDialog';

/** Value-diff dirty check: any field differs from its initial value. */
export function formIsDirty<T>(current: T, initial: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}

export interface UnsavedChangesGuardOptions {
  /** Called at close time — pass a closure over current state. */
  isDirty: () => boolean;
  /** The actual close/leave action, run when clean or after "Discard". */
  onClose: () => void;
  /** Override the dialog body copy for context-specific wording. */
  description?: string;
}

export function useUnsavedChangesGuard({ isDirty, onClose, description }: UnsavedChangesGuardOptions) {
  const { confirm, confirmDialog } = useConfirmDialog();

  const requestClose = useCallback(async () => {
    if (isDirty()) {
      const discard = await confirm({
        title: 'Discard changes?',
        description:
          description ??
          "Your changes haven't been saved. Closing now will lose everything you've entered.",
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
      });
      if (!discard) return;
    }
    onClose();
  }, [isDirty, onClose, description, confirm]);

  return { requestClose, guardDialog: confirmDialog };
}
