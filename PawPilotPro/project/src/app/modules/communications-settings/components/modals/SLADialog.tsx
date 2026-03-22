// SLA Dialog - Communications Settings

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import type { SLADefinition } from '../../types';

interface SLADialogProps {
  open: boolean;
  onClose: () => void;
  sla: SLADefinition | null;
}

export function SLADialog({ open, onClose, sla }: SLADialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sla ? 'Edit' : 'Create'} SLA Definition</DialogTitle>
          <DialogDescription>
            SLA configuration coming soon - response time targets, business hours, and channel overrides
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-slate-500">
          SLA configuration under construction
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
