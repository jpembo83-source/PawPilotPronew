// SLA Section - Communications Settings

import React, { useState } from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Plus, Clock, PencilSimple, Trash, Buildings, MapPin } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { SLADialog } from './modals/SLADialog';
import type { SLADefinition } from '../types';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

export function SLASection() {
  const { slaDefinitions, deleteSLADefinition } = useCommunicationsSettingsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSLA, setEditingSLA] = useState<SLADefinition | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const handleEdit = (sla: SLADefinition) => {
    setEditingSLA(sla);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete this SLA definition?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteSLADefinition(id);
      toast.success('SLA definition deleted');
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingSLA(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Response SLAs</h3>
          <p className="text-sm text-slate-600 mt-1">
            Define expected response times for inbound customer messages
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add SLA
        </Button>
      </div>

      {/* SLA List */}
      {slaDefinitions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No SLA definitions configured</p>
            <p className="text-xs mt-1">Define response time targets for your team</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {slaDefinitions.map((sla) => (
            <Card key={sla.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {sla.scope === 'organisation' ? (
                        <Buildings className="h-4 w-4 text-slate-400" />
                      ) : (
                        <MapPin className="h-4 w-4 text-slate-400" />
                      )}
                      <h4 className="font-medium text-slate-900">{sla.name}</h4>
                      {sla.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      {sla.isActive ? (
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{sla.description}</p>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-xs text-slate-500">Response Time:</span>
                        <p className="font-medium">{sla.responseTimeMinutes} minutes</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Scope:</span>
                        <p className="font-medium capitalize">{sla.scopeName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Business Hours:</span>
                        <p className="font-medium">{sla.businessHoursOnly ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    
                    {sla.channelOverrides && sla.channelOverrides.length > 0 && (
                      <div className="text-xs text-slate-600">
                        <span className="font-medium">Channel overrides:</span>
                        <div className="flex gap-2 mt-1">
                          {sla.channelOverrides.map((override) => (
                            <Badge key={override.channel} variant="outline" className="text-xs capitalize">
                              {override.channel}: {override.responseTimeMinutes}m
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(sla)}>
                      <PencilSimple className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(sla.id)}>
                      <Trash className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <SLADialog
        open={dialogOpen}
        onClose={handleClose}
        sla={editingSLA}
      />

      {confirmDialog}
    </div>
  );
}
