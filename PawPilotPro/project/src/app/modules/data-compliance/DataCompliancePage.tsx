// Data & Compliance Module - MDC Operations Centre

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Loader2 } from 'lucide-react';
import { useDataComplianceStore } from './store';
import { OverviewPage } from './pages/OverviewPage';
import { DataSubjectRequestsPage } from './pages/DataSubjectRequestsPage';
import { DataExportsPage } from './pages/DataExportsPage';
import { AccessLogsPage } from './pages/AccessLogsPage';
import { RetentionJobsPage } from './pages/RetentionJobsPage';
import { IncidentsBreachesPage } from './pages/IncidentsBreachesPage';
import { AuditLogPage } from './pages/AuditLogPage';

export function DataCompliancePage() {
  const { loadAll, seedData, isLoading } = useDataComplianceStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSeed = async () => {
    if (confirm('This will create sample compliance data. Continue?')) {
      await seedData();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl">Data & Compliance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              GDPR workflows, data exports, access monitoring, and breach management
            </p>
          </div>
          <Button onClick={handleSeed} variant="outline" size="sm">
            Seed Data
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b bg-white px-6">
              <TabsList className="grid grid-cols-7 w-full max-w-4xl">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="requests">GDPR Requests</TabsTrigger>
                <TabsTrigger value="exports">Exports</TabsTrigger>
                <TabsTrigger value="access-logs">Access Logs</TabsTrigger>
                <TabsTrigger value="retention">Retention</TabsTrigger>
                <TabsTrigger value="breaches">Breaches</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto">
              <TabsContent value="overview" className="m-0 p-6">
                <OverviewPage />
              </TabsContent>

              <TabsContent value="requests" className="m-0 p-6">
                <DataSubjectRequestsPage />
              </TabsContent>

              <TabsContent value="exports" className="m-0 p-6">
                <DataExportsPage />
              </TabsContent>

              <TabsContent value="access-logs" className="m-0 p-6">
                <AccessLogsPage />
              </TabsContent>

              <TabsContent value="retention" className="m-0 p-6">
                <RetentionJobsPage />
              </TabsContent>

              <TabsContent value="breaches" className="m-0 p-6">
                <IncidentsBreachesPage />
              </TabsContent>

              <TabsContent value="audit" className="m-0 p-6">
                <AuditLogPage />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
