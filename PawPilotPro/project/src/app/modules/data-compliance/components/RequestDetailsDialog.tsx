// Request Details Dialog

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { useDataComplianceStore } from '../store';
import type { DataSubjectRequest, RequestAction } from '../types';

interface RequestDetailsDialogProps {
  request: DataSubjectRequest | null;
  onClose: () => void;
}

export function RequestDetailsDialog({ request, onClose }: RequestDetailsDialogProps) {
  const { loadRequestActions, updateRequest, createRequestAction } = useDataComplianceStore();
  const [actions, setActions] = useState<RequestAction[]>([]);

  useEffect(() => {
    if (request) {
      loadRequestActions(request.id).then(setActions);
    }
  }, [request, loadRequestActions]);

  if (!request) return null;

  const handleStatusChange = async (newStatus: string) => {
    await updateRequest(request.id, { status: newStatus as any, updated_by: 'current-user' });
    onClose();
  };

  const handleAddAction = async (actionType: string) => {
    await createRequestAction(request.id, {
      action_type: actionType as any,
      action_description: `${actionType} action performed`,
      performed_by: 'current-user',
    });
    const updatedActions = await loadRequestActions(request.id);
    setActions(updatedActions);
  };

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Data Subject Request Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Request Type</p>
              <Badge className="mt-1 capitalize">{request.request_type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className="mt-1 capitalize" variant="default">{request.status.replace(/_/g, ' ')}</Badge>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm text-muted-foreground">Household</p>
            <p className="font-medium">{request.household_name}</p>
            <p className="text-xs text-muted-foreground">ID: {request.household_id}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Data Categories</p>
            <div className="flex gap-2 mt-1">
              {request.data_categories.map((cat) => (
                <Badge key={cat} variant="outline" className="capitalize">{cat}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Scope Description</p>
            <p className="text-sm mt-1">{request.scope_description}</p>
          </div>

          <Separator />

          <div>
            <p className="font-medium mb-2">Actions ({actions.length})</p>
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions yet</p>
            ) : (
              <div className="space-y-2">
                {actions.map((action) => (
                  <div key={action.id} className="border rounded p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <Badge className="capitalize">{action.action_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(action.performed_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2">{action.action_description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex gap-2 flex-wrap">
            {request.status === 'pending' && (
              <>
                <Button size="sm" onClick={() => handleStatusChange('in_review')}>Move to Review</Button>
                <Button size="sm" variant="outline" onClick={() => handleAddAction('review')}>Add Review Action</Button>
              </>
            )}
            {request.status === 'in_review' && (
              <>
                <Button size="sm" onClick={() => handleStatusChange('in_progress')}>Start Processing</Button>
                <Button size="sm" variant="outline" onClick={() => handleAddAction('export')}>Export Data</Button>
              </>
            )}
            {request.status === 'in_progress' && (
              <Button size="sm" onClick={() => handleStatusChange('completed')}>Complete Request</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
