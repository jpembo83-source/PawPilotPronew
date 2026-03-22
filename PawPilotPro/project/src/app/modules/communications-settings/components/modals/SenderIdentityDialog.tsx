// Sender Identity Dialog - Communications Settings

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { useAuth } from '../../../../context/AuthContext';
import { useCommunicationsSettingsStore } from '../../store';
import { toast } from 'sonner';
import type { SenderIdentity } from '../../types';

interface SenderIdentityDialogProps {
  open: boolean;
  onClose: () => void;
  identity: SenderIdentity | null;
}

export function SenderIdentityDialog({ open, onClose, identity }: SenderIdentityDialogProps) {
  const { user } = useAuth();
  const { createSenderIdentity, updateSenderIdentity } = useCommunicationsSettingsStore();
  
  const [scope, setScope] = useState<'organisation' | 'location'>('organisation');
  const [scopeName, setScopeName] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailSenderEmail, setEmailSenderEmail] = useState('');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [smsPhoneNumber, setSmsPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappDisplayName, setWhatsappDisplayName] = useState('');

  useEffect(() => {
    if (identity) {
      setScope(identity.scope);
      setScopeName(identity.scopeName);
      setEmailSenderName(identity.email?.senderName || '');
      setEmailSenderEmail(identity.email?.senderEmail || '');
      setEmailReplyTo(identity.email?.replyToEmail || '');
      setSmsSenderId(identity.sms?.senderId || '');
      setSmsPhoneNumber(identity.sms?.phoneNumber || '');
      setWhatsappNumber(identity.whatsapp?.phoneNumber || '');
      setWhatsappDisplayName(identity.whatsapp?.displayName || '');
    } else {
      // Reset
      setScope('organisation');
      setScopeName('');
      setEmailSenderName('');
      setEmailSenderEmail('');
      setEmailReplyTo('');
      setSmsSenderId('');
      setSmsPhoneNumber('');
      setWhatsappNumber('');
      setWhatsappDisplayName('');
    }
  }, [identity, open]);

  const handleSubmit = async () => {
    if (!scopeName.trim()) {
      toast.error('Please enter a scope name');
      return;
    }

    const data: Partial<SenderIdentity> = {
      scope,
      scopeId: scope === 'organisation' ? 'ORG' : scopeName,
      scopeName,
      email: emailSenderName && emailSenderEmail ? {
        senderName: emailSenderName,
        senderEmail: emailSenderEmail,
        replyToEmail: emailReplyTo || undefined,
      } : undefined,
      sms: smsSenderId ? {
        senderId: smsSenderId,
        phoneNumber: smsPhoneNumber || undefined,
      } : undefined,
      whatsapp: whatsappNumber ? {
        phoneNumber: whatsappNumber,
        displayName: whatsappDisplayName || undefined,
      } : undefined,
      createdBy: user?.id || 'unknown',
      updatedBy: user?.id || 'unknown',
    };

    try {
      if (identity) {
        await updateSenderIdentity(identity.id, data);
        toast.success('Sender identity updated');
      } else {
        await createSenderIdentity(data);
        toast.success('Sender identity created');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{identity ? 'Edit' : 'Add'} Sender Identity</DialogTitle>
          <DialogDescription>
            Configure how messages appear to customers for this scope
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scope */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organisation">Organisation</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{scope === 'organisation' ? 'Organisation Name' : 'Location Name'}</Label>
              <Input
                value={scopeName}
                onChange={(e) => setScopeName(e.target.value)}
                placeholder={scope === 'organisation' ? 'MDC Operations' : 'Downtown Branch'}
              />
            </div>
          </div>

          {/* Email */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Sender Name</Label>
                <Input
                  value={emailSenderName}
                  onChange={(e) => setEmailSenderName(e.target.value)}
                  placeholder="MDC Dog Daycare"
                />
              </div>
              <div className="space-y-2">
                <Label>Sender Email</Label>
                <Input
                  type="email"
                  value={emailSenderEmail}
                  onChange={(e) => setEmailSenderEmail(e.target.value)}
                  placeholder="hello@mdcdogdaycare.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Reply-To Email (Optional)</Label>
                <Input
                  type="email"
                  value={emailReplyTo}
                  onChange={(e) => setEmailReplyTo(e.target.value)}
                  placeholder="support@mdcdogdaycare.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* SMS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SMS Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Sender ID</Label>
                <Input
                  value={smsSenderId}
                  onChange={(e) => setSmsSenderId(e.target.value)}
                  placeholder="MDC Daycare"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number (Optional)</Label>
                <Input
                  value={smsPhoneNumber}
                  onChange={(e) => setSmsPhoneNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WhatsApp Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Name (Optional)</Label>
                <Input
                  value={whatsappDisplayName}
                  onChange={(e) => setWhatsappDisplayName(e.target.value)}
                  placeholder="MDC Dog Daycare"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {identity ? 'Update' : 'Create'} Sender Identity
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}