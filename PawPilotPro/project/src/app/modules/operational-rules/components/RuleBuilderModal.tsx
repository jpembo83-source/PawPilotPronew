import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface RuleBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RuleBuilderModal({ open, onClose, onSuccess }: RuleBuilderModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rule Builder</DialogTitle>
          <DialogDescription>
            Create a new operational rule
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Rule Builder UI - Phase 2 implementation. This will include a step-by-step wizard for creating rules with:
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Module and category selection</li>
              <li>Event trigger selection</li>
              <li>Condition builder (visual, no code)</li>
              <li>Action/outcome configuration</li>
              <li>Scope and targeting</li>
              <li>Rule preview and test mode</li>
            </ul>
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
