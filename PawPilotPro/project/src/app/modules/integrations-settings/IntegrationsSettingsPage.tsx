// Integrations Settings Page - MDC Operations Centre

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CircleNotch } from '@phosphor-icons/react';
import { useIntegrationsSettingsStore } from './store';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export function IntegrationsSettingsPage() {
  const { loadAll, seedData, isLoading, stats, catalogue, integrations, credentials, webhooks, syncJobs, logs, alerts, auditLogs } = useIntegrationsSettingsStore();
  const [activeTab, setActiveTab] = useState('catalogue');
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSeed = async () => {
    if (
      await confirm({
        title: 'Create sample integration data?',
        description: 'This will create sample integration data.',
        confirmLabel: 'Continue',
      })
    ) {
      await seedData();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl">Integrations Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure and manage third-party integrations, credentials, webhooks, and data sync
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="flex items-center gap-4 mr-4 text-sm">
                <div>
                  <Badge variant="outline">{stats.active_integrations} Active</Badge>
                </div>
                {stats.integrations_with_errors > 0 && (
                  <div>
                    <Badge variant="destructive">{stats.integrations_with_errors} Errors</Badge>
                  </div>
                )}
                {stats.unresolved_alerts > 0 && (
                  <div>
                    <Badge variant="destructive">{stats.unresolved_alerts} Alerts</Badge>
                  </div>
                )}
              </div>
            )}
            <Button onClick={handleSeed} variant="outline" size="sm">
              Seed Data
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-8 w-full">
              <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
              <TabsTrigger value="connected">Connected</TabsTrigger>
              <TabsTrigger value="credentials">Credentials</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="sync">Sync Jobs</TabsTrigger>
              <TabsTrigger value="health">Health & Logs</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="catalogue">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Catalogue</CardTitle>
                  <CardDescription>Available integrations for the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalogue.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.name}</TableCell>
                          <TableCell className="capitalize">{entry.category.replace(/_/g, ' ')}</TableCell>
                          <TableCell>{entry.provider}</TableCell>
                          <TableCell>
                            <Badge variant={entry.status === 'available' ? 'success' : 'secondary'} className="capitalize">
                              {entry.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="connected">
              <Card>
                <CardHeader>
                  <CardTitle>Connected Integrations</CardTitle>
                  <CardDescription>Active third-party connections</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Sync</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrations.map((integration) => (
                        <TableRow key={integration.id}>
                          <TableCell className="font-medium">{integration.name}</TableCell>
                          <TableCell>{integration.provider}</TableCell>
                          <TableCell className="capitalize">{integration.scope}</TableCell>
                          <TableCell>
                            <Badge variant={integration.health_status === 'healthy' ? 'success' : 'destructive'}>
                              {integration.health_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={integration.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                              {integration.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : 'Never'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="credentials">
              <Card>
                <CardHeader>
                  <CardTitle>Credentials & Secrets</CardTitle>
                  <CardDescription>Encrypted authentication credentials</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Encrypted</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Last Rotated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credentials.map((cred) => (
                        <TableRow key={cred.id}>
                          <TableCell className="font-medium">{cred.credential_name}</TableCell>
                          <TableCell className="capitalize">{cred.credential_type.replace(/_/g, ' ')}</TableCell>
                          <TableCell>
                            <Badge variant="success">{cred.is_encrypted ? 'Yes' : 'No'}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {cred.expires_at ? new Date(cred.expires_at).toLocaleDateString() : 'No expiry'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {cred.last_rotated_at ? new Date(cred.last_rotated_at).toLocaleDateString() : 'Never'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhooks">
              <Card>
                <CardHeader>
                  <CardTitle>Webhooks & Events</CardTitle>
                  <CardDescription>Event-driven integration endpoints</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Delivery</TableHead>
                        <TableHead>Failures</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell className="font-mono text-xs">{webhook.endpoint_url}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{webhook.subscribed_events.length} events</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={webhook.is_active ? 'success' : 'secondary'}>
                              {webhook.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {webhook.last_delivery_at ? new Date(webhook.last_delivery_at).toLocaleString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            {webhook.failure_count > 0 && (
                              <Badge variant="destructive">{webhook.failure_count}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync">
              <Card>
                <CardHeader>
                  <CardTitle>Synchronisation Jobs</CardTitle>
                  <CardDescription>Recent sync executions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Integration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Manual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncJobs.slice(0, 20).map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-mono text-xs">{job.integration_id.slice(0, 12)}</TableCell>
                          <TableCell>
                            <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{new Date(job.started_at).toLocaleString()}</TableCell>
                          <TableCell>{job.records_processed}</TableCell>
                          <TableCell>
                            {job.records_processed > 0
                              ? `${Math.round((job.records_succeeded / job.records_processed) * 100)}%`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {job.is_manual && <Badge variant="outline">Manual</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Logs</CardTitle>
                  <CardDescription>Request/response activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Integration</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.slice(0, 20).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{new Date(log.timestamp).toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-xs">{log.integration_id.slice(0, 12)}</TableCell>
                          <TableCell className="capitalize">{log.log_type}</TableCell>
                          <TableCell className="text-xs">{log.endpoint}</TableCell>
                          <TableCell>
                            {log.status_code && (
                              <Badge variant={log.status_code < 400 ? 'success' : 'destructive'}>{log.status_code}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{log.duration_ms ? `${log.duration_ms}ms` : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Alerts</CardTitle>
                  <CardDescription>Failures and warnings</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Integration</TableHead>
                        <TableHead>Alert Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell className="font-mono text-xs">{alert.integration_id.slice(0, 12)}</TableCell>
                          <TableCell className="capitalize">{alert.alert_type.replace(/_/g, ' ')}</TableCell>
                          <TableCell>
                            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'} className="capitalize">
                              {alert.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{alert.message}</TableCell>
                          <TableCell className="text-sm">{new Date(alert.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={alert.is_resolved ? 'success' : 'destructive'}>
                              {alert.is_resolved ? 'Resolved' : 'Open'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Audit Log</CardTitle>
                  <CardDescription>Complete change history</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Integration</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.slice(0, 50).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className="capitalize">{log.action_type.replace(/_/g, ' ')}</Badge>
                          </TableCell>
                          <TableCell>{log.integration_name}</TableCell>
                          <TableCell>{log.user_name}</TableCell>
                          <TableCell className="capitalize">{log.user_role}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
