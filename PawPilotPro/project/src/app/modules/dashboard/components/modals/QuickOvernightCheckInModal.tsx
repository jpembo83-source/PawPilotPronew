import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Moon } from 'lucide-react';

interface QuickOvernightCheckInModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickOvernightCheckInModal({ open, onClose }: QuickOvernightCheckInModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Overnight Check-in
          </DialogTitle>
          <DialogDescription>
            Overnight boarding features coming soon
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 text-center text-slate-500">
          <Moon className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">Overnight Boarding</p>
          <p className="text-sm mt-2">
            This feature will provide overnight boarding check-in and management
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
