import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Truck, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';

interface QuickTransportModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickTransportModal({ open, onClose }: QuickTransportModalProps) {
  const navigate = useNavigate();

  const handleViewTransport = () => {
    onClose();
    navigate('/transport');
  };

  const handleViewJobs = () => {
    onClose();
    navigate('/transport/jobs');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport
          </DialogTitle>
          <DialogDescription>
            Quick access to transport management
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <button
            onClick={handleViewTransport}
            className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Transport Dashboard</p>
                <p className="text-sm text-slate-500">Overview and route planning</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
          </button>

          <button
            onClick={handleViewJobs}
            className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Truck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">All Jobs</p>
                <p className="text-sm text-slate-500">View and manage transport jobs</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
