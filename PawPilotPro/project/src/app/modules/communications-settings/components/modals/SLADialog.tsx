// SLA Dialog - Communications Settings

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
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
            Configure response time targets and service level commitments
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Clock, label: 'Response Time', desc: 'Target response window' },
              { icon: AlertCircle, label: 'Escalation', desc: 'Breach notification rules' },
              { icon: CheckCircle2, label: 'Resolution', desc: 'Expected resolution time' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="p-4 border border-slate-200 rounded-lg text-center space-y-2 opacity-50">
                <Icon className="h-8 w-8 mx-auto text-slate-400" />
                <p className="font-medium text-slate-700 text-sm">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-500">
            SLA configuration is managed via the backend settings. Contact your administrator to configure service level definitions.
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
