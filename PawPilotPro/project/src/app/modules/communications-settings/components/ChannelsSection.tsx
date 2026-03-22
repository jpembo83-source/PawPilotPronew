// Channels Section - Communications Settings

import React from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Mail, MessageSquare, Phone, Circle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';

const channelIcons = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

const statusColors = {
  active: 'text-green-600 bg-green-50',
  misconfigured: 'text-amber-600 bg-amber-50',
  disabled: 'text-slate-400 bg-slate-50',
};

export function ChannelsSection() {
  const { channels, updateChannel } = useCommunicationsSettingsStore();
  const { user } = useAuth();

  const handleToggle = async (channelId: string, currentEnabled: boolean) => {
    try {
      await updateChannel(channelId, {
        isEnabled: !currentEnabled,
        organisationEnabled: !currentEnabled,
        status: !currentEnabled ? 'active' : 'disabled',
        lastUpdatedBy: user?.id || 'unknown',
        lastUpdatedByName: user?.name || 'Unknown User',
      });
      toast.success(`${channelId.toUpperCase()} channel ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error(`Failed to update channel: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Communication Channels</h3>
        <p className="text-sm text-slate-600 mt-1">
          Enable or disable communication channels organisation-wide. Disabled channels cannot be used anywhere in the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {channels.map((channel) => {
          const Icon = channelIcons[channel.channel as keyof typeof channelIcons];
          const statusColor = statusColors[channel.status];
          
          return (
            <Card key={channel.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${channel.isEnabled ? 'bg-primary/10' : 'bg-slate-100'}`}>
                      <Icon className={`h-5 w-5 ${channel.isEnabled ? 'text-primary' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base capitalize">{channel.channel}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {channel.isEnabled ? 'Available' : 'Disabled'}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={channel.isEnabled}
                    onCheckedChange={() => handleToggle(channel.id, channel.isEnabled)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <Circle className={`h-2 w-2 fill-current ${statusColor}`} />
                    <Badge variant="outline" className={statusColor}>
                      {channel.status}
                    </Badge>
                  </div>

                  {/* Location Config Summary */}
                  <div className="text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Locations configured:</span>
                      <span className="font-medium">{channel.locationConfigs?.length || 0}</span>
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="text-xs text-slate-500 border-t pt-2">
                    Updated by {channel.lastUpdatedByName}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <Circle className="h-4 w-4 text-blue-600 mt-0.5" />
            </div>
            <div className="text-sm text-slate-700 space-y-1">
              <p><strong>Channel Enforcement:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Disabled channels are hidden from all messaging interfaces</li>
                <li>Automation rules for disabled channels will not fire</li>
                <li>Templates referencing disabled channels cannot be selected</li>
                <li>Changes are enforced server-side and logged in audit trail</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
