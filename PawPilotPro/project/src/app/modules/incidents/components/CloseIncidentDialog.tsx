// Close Incident Dialog - Close incident with root cause and outcome

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { toast } from 'sonner';
import { useIncidentsStore } from '../store';
import { ROOT_CAUSES } from '../types';
import type { Incident } from '../types';

interface CloseIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  incident: Incident;
  onSuccess?: () => void;
}

export function CloseIncidentDialog({ open, onClose, incident, onSuccess }: CloseIncidentDialogProps) {
  const { closeIncident, isLoading } = useIncidentsStore();

  const [rootCause, setRootCause] = useState('');
  const [outcomeSummary, setOutcomeSummary] = useState('');
  const [preventativeAction, setPreventativeAction] = useState('');

  const handleSubmit = async () => {
    if (!rootCause) {
      toast.error('Please select a root cause');
      return;
    }

    if (!outcomeSummary.trim()) {
      toast.error('Please provide an outcome summary');
      return;
    }

    try {
      await closeIncident(incident.id, {
        root_cause: rootCause,
        outcome_summary: outcomeSummary.trim(),
        preventative_action: preventativeAction.trim() || undefined,
      });

      toast.success('Incident closed successfully');
      onSuccess?.();
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Close Incident</DialogTitle>
          <DialogDescription>
            Document the resolution and outcome of this incident before closing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Root Cause *</Label>
            <Select value={rootCause} onValueChange={setRootCause}>
              <SelectTrigger>
                <SelectValue placeholder="Select root cause..." />
              </SelectTrigger>
              <SelectContent>
                {ROOT_CAUSES.map(cause => (
                  <SelectItem key={cause} value={cause}>{cause}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Outcome Summary *</Label>
            <Textarea
              placeholder="Describe the outcome and how the incident was resolved..."
              value={outcomeSummary}
              onChange={(e) => setOutcomeSummary(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label>Preventative Action (Recommended)</Label>
            <Textarea
              placeholder="What actions will be taken to prevent similar incidents in future..."
              value={preventativeAction}
              onChange={(e) => setPreventativeAction(e.target.value)}
              rows={3}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-900">
              ⚠️ Once closed, this incident can only be reopened by an Admin or Manager
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Closing...' : 'Close Incident'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
