import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Truck } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';

interface QuickTransportModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickTransportModal({ open, onClose }: QuickTransportModalProps) {
  const navigate = useNavigate();

  const handleViewTransport = () => {
    onClose();
    // Navigate to transport module when it exists
    // navigate('/transport');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport Quick Access
          </DialogTitle>
          <DialogDescription>
            Transport management features coming soon
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 text-center text-slate-500">
          <Truck className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">Transport Module</p>
          <p className="text-sm mt-2">
            This feature will provide quick access to transport scheduling and driver assignments
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
