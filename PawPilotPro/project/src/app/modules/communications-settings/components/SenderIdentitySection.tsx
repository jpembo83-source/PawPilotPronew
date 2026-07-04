// Sender Identity Section - Communications Settings

import React, { useState } from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Buildings, MapPin, EnvelopeSimple, Phone, ChatTeardrop, Plus, PencilSimple, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { SenderIdentityDialog } from './modals/SenderIdentityDialog';
import type { SenderIdentity } from '../types';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

export function SenderIdentitySection() {
  const { senderIdentities, deleteSenderIdentity } = useCommunicationsSettingsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState<SenderIdentity | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const handleEdit = (identity: SenderIdentity) => {
    setEditingIdentity(identity);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete this sender identity?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteSenderIdentity(id);
      toast.success('Sender identity deleted');
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingIdentity(null);
  };

  const organisationIdentities = senderIdentities.filter(si => si.scope === 'organisation');
  const locationIdentities = senderIdentities.filter(si => si.scope === 'location');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Sender Identity</h3>
          <p className="text-sm text-slate-600 mt-1">
            Configure how messages appear to customers. Location identities override organisation defaults.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Sender Identity
        </Button>
      </div>

      {/* Organisation-level Identities */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Buildings className="h-4 w-4 text-slate-600" />
          <h4 className="font-medium text-slate-900">Organisation Default</h4>
        </div>
        
        {organisationIdentities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-slate-500">
              No organisation default sender identity configured. Click "Add Sender Identity" to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {organisationIdentities.map((identity) => (
              <SenderIdentityCard 
                key={identity.id} 
                identity={identity}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Location-specific Identities */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-slate-600" />
          <h4 className="font-medium text-slate-900">Location Overrides</h4>
          <Badge variant="outline" className="text-xs">{locationIdentities.length}</Badge>
        </div>
        
        {locationIdentities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-slate-500">
              No location-specific sender identities configured.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {locationIdentities.map((identity) => (
              <SenderIdentityCard 
                key={identity.id} 
                identity={identity}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <SenderIdentityDialog
        open={dialogOpen}
        onClose={handleClose}
        identity={editingIdentity}
      />

      {confirmDialog}
    </div>
  );
}

interface SenderIdentityCardProps {
  identity: SenderIdentity;
  onEdit: (identity: SenderIdentity) => void;
  onDelete: (id: string) => void;
}

function SenderIdentityCard({ identity, onEdit, onDelete }: SenderIdentityCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{identity.scopeName}</CardTitle>
            <CardDescription className="text-xs">
              {identity.scope === 'organisation' ? 'Organisation Default' : 'Location Override'}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(identity)}>
              <PencilSimple className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(identity.id)}>
              <Trash className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {identity.email && (
          <div className="flex items-start gap-2 text-xs">
            <EnvelopeSimple className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
            <div>
              <div className="font-medium">{identity.email.senderName}</div>
              <div className="text-slate-600">{identity.email.senderEmail}</div>
              {identity.email.replyToEmail && (
                <div className="text-slate-500">Reply: {identity.email.replyToEmail}</div>
              )}
            </div>
          </div>
        )}
        {identity.sms && (
          <div className="flex items-start gap-2 text-xs">
            <Phone className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
            <div>
              <div className="font-medium">{identity.sms.senderId}</div>
              {identity.sms.phoneNumber && (
                <div className="text-slate-600">{identity.sms.phoneNumber}</div>
              )}
            </div>
          </div>
        )}
        {identity.whatsapp && (
          <div className="flex items-start gap-2 text-xs">
            <ChatTeardrop className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
            <div>
              <div className="font-medium">{identity.whatsapp.displayName || identity.whatsapp.phoneNumber}</div>
              <div className="text-slate-600">{identity.whatsapp.phoneNumber}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
