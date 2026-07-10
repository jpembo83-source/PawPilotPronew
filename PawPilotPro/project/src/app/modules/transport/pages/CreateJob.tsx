/**
 * Create Transport Job - Standalone page for creating new transport jobs
 * British English throughout, production-grade, no mock data
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import { CreateTransportJobDialog } from '../components/CreateTransportJobDialog';
import { format, startOfToday } from 'date-fns';

import { useBackNavigation } from '../../../components/BackButton';
export function CreateJob() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/transport');
  const [showDialog, setShowDialog] = useState(true);
  
  const handleJobCreated = () => {
    navigate('/transport');
  };
  
  const handleCancel = () => {
    navigate('/transport');
  };
  
  return (
    <div className="h-[calc(100vh-100px)] flex items-center justify-center bg-slate-50">
      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={goBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transport
          </Button>
        </div>
        
        <CreateTransportJobDialog
          open={showDialog}
          onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) {
              navigate('/transport');
            }
          }}
          defaultDate={startOfToday()}
          defaultLocationId=""
          onJobCreated={handleJobCreated}
        />
      </div>
    </div>
  );
}
