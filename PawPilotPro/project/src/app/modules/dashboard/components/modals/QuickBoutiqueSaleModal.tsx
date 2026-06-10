import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { ShoppingBag } from '@phosphor-icons/react';

interface QuickBoutiqueSaleModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickBoutiqueSaleModal({ open, onClose }: QuickBoutiqueSaleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Record Sale
          </DialogTitle>
          <DialogDescription>
            Boutique sales features coming soon
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 text-center text-slate-500">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">Boutique Sales</p>
          <p className="text-sm mt-2">
            This feature will provide quick point-of-sale for boutique items
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
