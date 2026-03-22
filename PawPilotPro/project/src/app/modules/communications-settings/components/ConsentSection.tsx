// Consent Section - Communications Settings

import React from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { ShieldCheck, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';

export function ConsentSection() {
  const { consentPolicy, updateConsentPolicy } = useCommunicationsSettingsStore();
  const { user } = useAuth();

  const handleUpdate = async (updates: any) => {
    try {
      await updateConsentPolicy({
        ...updates,
        updatedBy: user?.id || 'unknown',
        updatedByName: user?.name || 'Unknown User',
      });
      toast.success('Consent policy updated');
    } catch (error: any) {
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  if (!consentPolicy) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Consent & Preferences</h3>
        <p className="text-sm text-slate-600 mt-1">
          Configure how customer consent is interpreted and enforced across all communications.
        </p>
      </div>

      {/* Critical Enforcement Notice */}
      <Alert className="border-red-200 bg-red-50">
        <Lock className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-sm text-red-900">
          <strong>Non-negotiable:</strong> Operational messages always require consent, and sending is always blocked when consent is missing.
          These settings cannot be disabled.
        </AlertDescription>
      </Alert>

      {/* Default Opt-in Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Default Opt-in for New Contacts</CardTitle>
          <CardDescription>
            When a new contact is created, these channels are opted-in by default
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="default-email">Email</Label>
              <p className="text-xs text-slate-600">Default opt-in for email communications</p>
            </div>
            <Switch
              id="default-email"
              checked={consentPolicy.defaultOptIn.email}
              onCheckedChange={(checked) => 
                handleUpdate({ 
                  defaultOptIn: { ...consentPolicy.defaultOptIn, email: checked }
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="default-sms">SMS</Label>
              <p className="text-xs text-slate-600">Default opt-in for SMS communications</p>
            </div>
            <Switch
              id="default-sms"
              checked={consentPolicy.defaultOptIn.sms}
              onCheckedChange={(checked) => 
                handleUpdate({ 
                  defaultOptIn: { ...consentPolicy.defaultOptIn, sms: checked }
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="default-whatsapp">WhatsApp</Label>
              <p className="text-xs text-slate-600">Default opt-in for WhatsApp communications</p>
            </div>
            <Switch
              id="default-whatsapp"
              checked={consentPolicy.defaultOptIn.whatsapp}
              onCheckedChange={(checked) => 
                handleUpdate({ 
                  defaultOptIn: { ...consentPolicy.defaultOptIn, whatsapp: checked }
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Required Consent by Message Type */}
      <Card>
        <CardHeader>
          <CardTitle>Required Consent by Message Type</CardTitle>
          <CardDescription>
            Control which message types require explicit consent before sending
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between opacity-50">
            <div>
              <Label>Operational Messages</Label>
              <p className="text-xs text-slate-600">Check-in, pickup, grooming complete, etc.</p>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <Switch checked={true} disabled />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="consent-informational">Informational Messages</Label>
              <p className="text-xs text-slate-600">Reminders, document expiry, etc.</p>
            </div>
            <Switch
              id="consent-informational"
              checked={consentPolicy.requiredConsent.informational}
              onCheckedChange={(checked) => 
                handleUpdate({ 
                  requiredConsent: { ...consentPolicy.requiredConsent, informational: checked }
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="consent-promotional">Promotional Messages</Label>
              <p className="text-xs text-slate-600">Marketing, offers, announcements</p>
            </div>
            <Switch
              id="consent-promotional"
              checked={consentPolicy.requiredConsent.promotional}
              onCheckedChange={(checked) => 
                handleUpdate({ 
                  requiredConsent: { ...consentPolicy.requiredConsent, promotional: checked }
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Enforcement */}
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="text-sm text-slate-700 space-y-1">
              <p><strong>Consent Enforcement</strong></p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Consent is stored per contact, per channel</li>
                <li>Messages to contacts without consent are automatically blocked</li>
                <li>Messaging UI clearly explains when sending is blocked due to consent</li>
                <li>All consent changes are logged and auditable</li>
                <li>Consent status is verified before every message send</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-xs text-slate-500 text-right">
        Last updated by {consentPolicy.updatedByName} on {new Date(consentPolicy.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}
