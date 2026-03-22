import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { FileUp } from 'lucide-react';

interface QuickDocumentModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickDocumentModal({ open, onClose }: QuickDocumentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Upload Document
          </DialogTitle>
          <DialogDescription>
            Document upload features coming soon
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 text-center text-slate-500">
          <FileUp className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">Document Management</p>
          <p className="text-sm mt-2">
            This feature will provide quick document upload to customer records
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
