// Staff Management Portal - Main Page with Tabs
// Three tabs: Team Directory, Policies & Acknowledgements, Rotas

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { UsersThree, FileText, CalendarBlank } from '@phosphor-icons/react';
import { TeamDirectoryTab } from './TeamDirectoryTab';
import { PoliciesTab } from './PoliciesTab';
import { RotasTab } from './RotasTab';

export function StaffPage() {
  const [activeTab, setActiveTab] = useState('team');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Staff Management</h1>
        <p className="text-slate-600 mt-2">
          Manage your team, policies, and rotas
        </p>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-3">
          <TabsTrigger value="team" className="flex items-center gap-2">
            <UsersThree className="h-4 w-4" />
            Team Directory
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Policies & Acknowledgements
          </TabsTrigger>
          <TabsTrigger value="rotas" className="flex items-center gap-2">
            <CalendarBlank className="h-4 w-4" />
            Rotas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="team" className="mt-6">
          <TeamDirectoryTab />
        </TabsContent>
        
        <TabsContent value="policies" className="mt-6">
          <PoliciesTab />
        </TabsContent>
        
        <TabsContent value="rotas" className="mt-6">
          <RotasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}