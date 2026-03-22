// Automation Rule Dialog - Communications Settings

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Zap, ArrowRight, Clock, Bell } from 'lucide-react';
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
            Define triggers and automated message actions for operational events
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Bell className="h-5 w-5 text-slate-500 shrink-0" />
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            <Clock className="h-5 w-5 text-slate-500 shrink-0" />
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            <Zap className="h-5 w-5 text-slate-500 shrink-0" />
            <div className="ml-2">
              <p className="text-sm font-medium text-slate-700">Trigger → Delay → Action</p>
              <p className="text-xs text-slate-500">e.g. Booking confirmed → 24h before → Send reminder</p>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500">
            Automation rule configuration is managed via the backend settings. Contact your administrator to configure automation rules.
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
