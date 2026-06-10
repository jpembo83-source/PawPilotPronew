// View As Button - MDC Operations Centre
// Button to initiate View As mode for a specific user

import { useState } from 'react';
import { Eye } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useViewAs } from '../../context/ViewAsContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

interface ViewAsButtonProps {
  targetUserId: string;
  targetUserName: string;
  targetUserRole: string;
  disabled?: boolean;
}

export function ViewAsButton({ targetUserId, targetUserName, targetUserRole, disabled }: ViewAsButtonProps) {
  const { user } = useAuth();
  const { startViewAs, isLoading } = useViewAs();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');

  // Don't show button if trying to view as yourself
  if (user?.id === targetUserId) {
    return null;
  }

  // Don't allow viewing as another admin
  if (targetUserRole === 'admin') {
    return null;
  }

  const handleViewAs = async () => {
    try {
      await startViewAs(targetUserId, reason || undefined);
      setIsOpen(false);
      setReason('');
      toast.success(`Now viewing as ${targetUserName}`);
      
      // Reload the page to reset all state with new view-as context
      window.location.href = '/';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start View As mode';
      toast.error(message);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={disabled || isLoading}
      >
        <Eye className="h-4 w-4 mr-2" />
        View As
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View As User</DialogTitle>
            <DialogDescription>
              You will see the platform exactly as <strong>{targetUserName}</strong> ({targetUserRole}) sees it.
              All actions will be disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g. Troubleshooting permission issue, Training session, Access validation"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This will be logged for audit purposes
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded p-3">
              <p className="text-sm text-orange-900">
                <strong>Important:</strong> You will not be able to create, update, or delete any data while in View As mode.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleViewAs} disabled={isLoading}>
              <Eye className="h-4 w-4 mr-2" />
              Start View As
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}