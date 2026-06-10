// Template Builder Dialog - Communications Settings

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import type { CommunicationTemplate } from '../../types';

interface TemplateBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  template: CommunicationTemplate | null;
}

export function TemplateBuilderDialog({ open, onClose, template }: TemplateBuilderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit' : 'Create'} Message Template</DialogTitle>
          <DialogDescription>
            Template builder coming soon - full variable support, multi-channel formatting, and preview
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-slate-500">
          Template builder under construction
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
