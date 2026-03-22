// Reopen Incident Dialog - Reopen a closed incident

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { toast } from 'sonner';
import { useIncidentsStore } from '../store';
import type { Incident } from '../types';

interface ReopenIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  incident: Incident;
  onSuccess?: () => void;
}

export function ReopenIncidentDialog({ open, onClose, incident, onSuccess }: ReopenIncidentDialogProps) {
  const { reopenIncident, isLoading } = useIncidentsStore();
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for reopening');
      return;
    }

    try {
      await reopenIncident(incident.id, reason.trim());
      toast.success('Incident reopened successfully');
      onSuccess?.();
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reopen Incident</DialogTitle>
          <DialogDescription>
            Provide a reason for reopening this closed incident
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Reason for Reopening *</Label>
            <Textarea
              placeholder="Explain why this incident needs to be reopened..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Reopening...' : 'Reopen Incident'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
