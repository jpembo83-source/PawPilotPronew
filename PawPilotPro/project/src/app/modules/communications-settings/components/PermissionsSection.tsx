// Permissions Section - Communications Settings

import React from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { ShieldCheck, Mail, Phone, MessageSquare } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';

const channelIcons = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

export function PermissionsSection() {
  const { permissions, updatePermission } = useCommunicationsSettingsStore();
  const { user } = useAuth();

  const handleUpdate = async (permId: string, updates: any) => {
    try {
      await updatePermission(permId, {
        ...updates,
        updatedBy: user?.id || 'unknown',
        updatedByName: user?.name || 'Unknown User',
      });
      toast.success('Permission updated');
    } catch (error: any) {
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Permissions & Safeguards</h3>
        <p className="text-sm text-slate-600 mt-1">
          Control who can send messages and what restrictions apply to each role
        </p>
      </div>

      {/* Permissions by Role */}
      <div className="space-y-3">
        {permissions.map((perm) => (
          <Card key={perm.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base capitalize">{perm.role}</CardTitle>
                {perm.canSendMessages ? (
                  <Badge className="bg-green-100 text-green-700">Can Send</Badge>
                ) : (
                  <Badge variant="outline">Cannot Send</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Permissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Can Send Messages</Label>
                    <p className="text-xs text-slate-600">Allow this role to send any messages</p>
                  </div>
                  <Switch
                    checked={perm.canSendMessages}
                    onCheckedChange={(checked) => 
                      handleUpdate(perm.id, { canSendMessages: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Can Send Without Template</Label>
                    <p className="text-xs text-slate-600">Allow free-text messages</p>
                  </div>
                  <Switch
                    checked={perm.canSendWithoutTemplate}
                    onCheckedChange={(checked) => 
                      handleUpdate(perm.id, { canSendWithoutTemplate: checked })
                    }
                    disabled={!perm.canSendMessages}
                  />
                </div>
              </div>

              {/* Allowed Channels */}
              <div>
                <Label className="text-xs text-slate-500 mb-2 block">Allowed Channels</Label>
                <div className="flex gap-4">
                  {(['email', 'sms', 'whatsapp'] as const).map((channel) => {
                    const Icon = channelIcons[channel];
                    const isAllowed = perm.allowedChannels.includes(channel);
                    return (
                      <button
                        key={channel}
                        onClick={() => {
                          const newChannels = isAllowed
                            ? perm.allowedChannels.filter(c => c !== channel)
                            : [...perm.allowedChannels, channel];
                          handleUpdate(perm.id, { allowedChannels: newChannels });
                        }}
                        disabled={!perm.canSendMessages}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                          isAllowed
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        } ${!perm.canSendMessages ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="capitalize">{channel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Additional Info */}
              <div className="flex items-center gap-4 text-xs text-slate-600 pt-2 border-t">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Template Required:</span>
                  <Badge variant={perm.templateRequired ? "secondary" : "outline"} className="text-xs">
                    {perm.templateRequired ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {perm.restrictedModules && perm.restrictedModules.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Restricted:</span>
                    {perm.restrictedModules.map(mod => (
                      <Badge key={mod} variant="outline" className="text-xs capitalize">{mod}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="text-sm text-slate-700 space-y-1">
            <p><strong>Permission Enforcement:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Permissions are checked server-side on every message send</li>
              <li>UI restrictions alone are insufficient - backend validates all requests</li>
              <li>Driver and Night Shift roles have additional safeguards by default</li>
              <li>Template requirements cannot be bypassed without explicit permission</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
