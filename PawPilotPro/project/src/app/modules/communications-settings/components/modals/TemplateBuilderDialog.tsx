// Template Builder Dialog - Communications Settings

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { FileText, Mail, Phone, MessageSquare } from 'lucide-react';
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
            Configure message templates for email, SMS, and WhatsApp communications
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Mail, label: 'Email', desc: 'HTML and plain text templates' },
              { icon: Phone, label: 'SMS', desc: 'Short-form text messages' },
              { icon: MessageSquare, label: 'WhatsApp', desc: 'Rich message templates' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="p-4 border border-slate-200 rounded-lg text-center space-y-2 opacity-50">
                <Icon className="h-8 w-8 mx-auto text-slate-400" />
                <p className="font-medium text-slate-700 text-sm">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-500">
            Template builder configuration is managed via the backend settings. Contact your administrator to configure templates.
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
