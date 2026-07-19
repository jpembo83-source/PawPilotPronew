// Communications Settings Page - MDC Operations Centre

import React, { useEffect, useState } from 'react';
import { useCommunicationsSettingsStore } from './store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Radio,
  EnvelopeSimple,
  ChatTeardrop,
  FileText,
  ShieldCheck,
  MagnifyingGlass,
  CircleNotch,
  Warning
} from '@phosphor-icons/react';
import { ChannelsSection } from './components/ChannelsSection';
import { SenderIdentitySection } from './components/SenderIdentitySection';
import { ConsentSection } from './components/ConsentSection';
import { TemplatesSection } from './components/TemplatesSection';
import { PermissionsSection } from './components/PermissionsSection';
import { AuditLogsSection } from './components/AuditLogsSection';

// 'Automation' and 'Response SLAs' tabs hidden (owner-confirmed unused):
// enterprise-depth features a single daycare doesn't run. The section
// components and all server routes stay intact for easy re-enabling —
// restore the entries below and their TabsContent to bring them back.
const sections = [
  { id: 'channels', label: 'Channels', icon: Radio, description: 'Enable/disable communication channels' },
  { id: 'sender-identity', label: 'Sender Identity', icon: EnvelopeSimple, description: 'Configure sender details' },
  { id: 'consent', label: 'Consent', icon: ShieldCheck, description: 'Manage consent policies' },
  { id: 'templates', label: 'Templates', icon: FileText, description: 'Message templates' },
  { id: 'permissions', label: 'Permissions', icon: ChatTeardrop, description: 'Who can communicate' },
  { id: 'audit', label: 'Audit & Logs', icon: MagnifyingGlass, description: 'Changes and delivery logs' },
];

export function CommunicationsSettingsPage() {
  const { initialize, isLoading, error, clearError } = useCommunicationsSettingsStore();
  const [activeTab, setActiveTab] = useState('channels');

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <CircleNotch className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Communications Settings</h2>
        <p className="text-slate-600 mt-1">
          Configure channels, templates, consent, and messaging policies
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="underline text-sm">Dismiss</button>
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <Warning className="h-4 w-4" />
        <AlertDescription>
          All settings here directly control behavior in Messaging, Dashboard widgets, and automated communications.
          Changes are audited and enforced server-side.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <TabsTrigger 
                key={section.id} 
                value={section.id}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{section.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="channels" className="space-y-4">
          <ChannelsSection />
        </TabsContent>

        <TabsContent value="sender-identity" className="space-y-4">
          <SenderIdentitySection />
        </TabsContent>

        <TabsContent value="consent" className="space-y-4">
          <ConsentSection />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <TemplatesSection />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionsSection />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
