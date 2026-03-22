import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface QuickIncidentModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickIncidentModal({ open, onClose }: QuickIncidentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Report Incident
          </DialogTitle>
          <DialogDescription>
            Incident reporting features coming soon
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 text-center text-slate-500">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">Incident Reporting</p>
          <p className="text-sm mt-2">
            This feature will provide quick incident reporting and tracking
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
