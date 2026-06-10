// Automation Rule Dialog - Communications Settings

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import type { AutomationRule } from '../../types';

interface AutomationRuleDialogProps {
  open: boolean;
  onClose: () => void;
  rule: AutomationRule | null;
}

export function AutomationRuleDialog({ open, onClose, rule }: AutomationRuleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit' : 'Create'} Automation Rule</DialogTitle>
          <DialogDescription>
            Automation rule builder coming soon - event selection, template mapping, and timing configuration
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-slate-500">
          Automation rule builder under construction
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
