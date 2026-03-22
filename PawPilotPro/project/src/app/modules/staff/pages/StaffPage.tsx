// Staff Management Portal - Main Page with Tabs
// Three tabs: Team Directory, Policies & Acknowledgements, Rotas

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Users, FileText, Calendar } from 'lucide-react';
import { TeamDirectoryTab } from './TeamDirectoryTab';
import { PoliciesTab } from './PoliciesTab';
import { RotasTab } from './RotasTab';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

export function StaffPage() {
  const [activeTab, setActiveTab] = useState('team');
  
  // Ensure current user profile is synced on mount
  useEffect(() => {
    const syncUserProfile = async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/seed-admin`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );
        
        if (response.ok) {
          const result = await response.json();
          console.log('[Staff Page] User profile sync result:', result);
        }
      } catch (error) {
        console.error('[Staff Page] Failed to sync user profile:', error);
        // Don't show error to user - this is a background sync
      }
    };
    
    syncUserProfile();
  }, []);
  
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
            <Users className="h-4 w-4" />
            Team Directory
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Policies & Acknowledgements
          </TabsTrigger>
          <TabsTrigger value="rotas" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
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