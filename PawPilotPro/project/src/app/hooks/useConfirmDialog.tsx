import { useCallback, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { buttonVariants } from '../components/ui/button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm action as destructive (red). Use for deletes/discards. */
  destructive?: boolean;
}

/**
 * Promise-based replacement for window.confirm built on the shared AlertDialog
 * primitive. The cancel action receives focus when the dialog opens (Radix
 * default), so an accidental Enter never triggers the destructive path.
 *
 * Usage:
 *   const { confirm, confirmDialog } = useConfirmDialog();
 *   if (!(await confirm({ title: 'Delete this note?', destructive: true }))) return;
 *   // ...render {confirmDialog} anywhere in the component's JSX
 */
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    resolveRef.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOptions(null);
  };

  const confirmDialog = options ? (
    <AlertDialog open onOpenChange={(isOpen) => !isOpen && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description && (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            className={
              options.destructive ? buttonVariants({ variant: 'destructive' }) : undefined
            }
            onClick={() => settle(true)}
          >
            {options.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { confirm, confirmDialog };
}
