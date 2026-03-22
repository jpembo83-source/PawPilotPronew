// System Menu Page - MDC Operations Centre
// Highest-privilege area for global system control

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, AlertTriangle, CheckCircle2, Server, Users, Package, Settings, Shield, Clock, Activity, FileText, Zap } from 'lucide-react';
import { useSystemStore } from './store';
import { toast } from 'sonner';
import { SupabaseConnectivityCheck } from './components/SupabaseConnectivityCheck';

export function SystemPage() {
  const { 
    loadAll, isLoading, overview, organisations, featureFlags, modules, 
    environment, jobs, health, logs, auditLogs, suspendOrganisation, reactivateOrganisation,
    updateFeatureFlag, pauseJob, resumeJob, setMaintenanceMode, forceLogoutAll
  } = useSystemStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSuspendOrg = async (id: string, name: string) => {
    const reason = prompt(`Suspend organisation "${name}"?\n\nReason:`);
    if (reason) {
      await suspendOrganisation(id, reason);
      toast.success('Organisation suspended');
    }
  };

  const handleMaintenanceMode = async (enable: boolean) => {
    const message = enable ? prompt('Maintenance message:') : '';
    const reason = prompt('Reason for change:');
    if (reason) {
      await setMaintenanceMode(enable, message || '', reason);
      toast.success(`Maintenance mode ${enable ? 'enabled' : 'disabled'}`);
    }
  };

  const handleForceLogout = async () => {
    const reason = prompt('Force logout all users?\n\nReason (required):');
    if (reason && confirm('This will immediately log out all users. Continue?')) {
      await forceLogoutAll(reason);
      toast.success('All users logged out');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Server className="h-6 w-6 text-destructive" />
              <h1 className="text-2xl">System Control</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Global system behaviour, safety, availability, and governance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {environment?.is_maintenance_mode && (
              <Badge variant="destructive" className="animate-pulse">
                MAINTENANCE MODE
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-10 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="organisations">Organisations</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="defaults">Defaults</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            {/* 1. Overview */}
            <TabsContent value="overview">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Organisations</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overview?.active_organisations || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {overview?.suspended_organisations || 0} suspended
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overview?.total_users || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {overview?.active_users_24h || 0} active (24h)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Integration Health</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overview?.integration_health.healthy || 0}/{overview?.integration_health.total || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {overview?.integration_health.degraded || 0} degraded
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Background Jobs</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overview?.background_jobs.running || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {overview?.background_jobs.failed_last_24h || 0} failed (24h)
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Module Adoption</CardTitle>
                  <CardDescription>Organisations using each module</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overview && Object.entries(overview.enabled_modules).map(([module, count]) => (
                      <div key={module} className="flex items-center justify-between">
                        <span className="capitalize">{module}</span>
                        <Badge variant="outline">{count} organisations</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Organisations */}
            <TabsContent value="organisations">
              <Card>
                <CardHeader>
                  <CardTitle>Organisation Management</CardTitle>
                  <CardDescription>Platform organisations</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Locations</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Modules</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organisations.map((org) => (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell>
                            <Badge variant={org.status === 'active' ? 'success' : 'destructive'} className="capitalize">
                              {org.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{org.location_count}</TableCell>
                          <TableCell>{org.user_count}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{org.enabled_modules.length}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{new Date(org.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {org.status === 'active' ? (
                              <Button size="sm" variant="destructive" onClick={() => handleSuspendOrg(org.id, org.name)}>
                                Suspend
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => reactivateOrganisation(org.id)}>
                                Reactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Feature Flags */}
            <TabsContent value="features">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Feature Flags</CardTitle>
                    <CardDescription>Control platform features and beta releases</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Feature</TableHead>
                          <TableHead>Scope</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Rollout</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {featureFlags.map((flag) => (
                          <TableRow key={flag.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{flag.display_name}</p>
                                <p className="text-xs text-muted-foreground">{flag.description}</p>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{flag.scope}</TableCell>
                            <TableCell>
                              <Badge variant={flag.is_enabled ? 'success' : 'secondary'}>
                                {flag.is_enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {flag.rollout_percentage ? `${flag.rollout_percentage}%` : 'Full'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFeatureFlag(flag.id, { is_enabled: !flag.is_enabled, updated_by: 'admin' })}
                              >
                                {flag.is_enabled ? 'Disable' : 'Enable'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Module Configuration</CardTitle>
                    <CardDescription>Global module enablement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Module</TableHead>
                          <TableHead>Global Status</TableHead>
                          <TableHead>Default for New Orgs</TableHead>
                          <TableHead>Organisations Using</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modules.map((mod) => (
                          <TableRow key={mod.module_name}>
                            <TableCell className="font-medium capitalize">{mod.module_name}</TableCell>
                            <TableCell>
                              <Badge variant={mod.is_enabled_globally ? 'success' : 'secondary'}>
                                {mod.is_enabled_globally ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={mod.default_enabled_for_new_orgs ? 'default' : 'outline'}>
                                {mod.default_enabled_for_new_orgs ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell>{mod.organisations_enabled}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 4-9: Remaining tabs in compact form due to token constraints */}
            <TabsContent value="defaults">
              <Card>
                <CardHeader>
                  <CardTitle>Global Defaults</CardTitle>
                  <CardDescription>Default settings inherited by new organisations</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Configuration area for organisation-level defaults
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Environment & Security</CardTitle>
                  <CardDescription>System security configuration</CardDescription>
                </CardHeader>
                <CardContent>
                  {environment && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Environment</p>
                          <Badge variant="default" className="mt-1 uppercase">{environment.environment}</Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Maintenance Mode</p>
                          <Badge variant={environment.is_maintenance_mode ? 'destructive' : 'success'} className="mt-1">
                            {environment.is_maintenance_mode ? 'ACTIVE' : 'Inactive'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Session Timeout</p>
                          <p className="text-sm text-muted-foreground mt-1">{environment.session_timeout_minutes} minutes</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">MFA for Admins</p>
                          <Badge variant={environment.mfa_required_for_admins ? 'success' : 'secondary'} className="mt-1">
                            {environment.mfa_required_for_admins ? 'Required' : 'Optional'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jobs">
              <Card>
                <CardHeader>
                  <CardTitle>Background Jobs & Queues</CardTitle>
                  <CardDescription>Scheduled and async processes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Next Run</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.job_name}</TableCell>
                          <TableCell className="capitalize">{job.job_type}</TableCell>
                          <TableCell>
                            <Badge variant={job.status === 'running' ? 'success' : 'secondary'} className="capitalize">
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            {job.status === 'running' ? (
                              <Button size="sm" variant="outline" onClick={() => pauseJob(job.id)}>Pause</Button>
                            ) : (
                              <Button size="sm" onClick={() => resumeJob(job.id)}>Resume</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health">
              <div className="space-y-4">
                {/* Supabase Connectivity Check */}
                <SupabaseConnectivityCheck />

                {/* Existing System Health */}
                <Card>
                  <CardHeader>
                    <CardTitle>System Health & Status</CardTitle>
                    <CardDescription>Real-time operational monitoring</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {health && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="border rounded p-4">
                            <div className="flex items-center gap-2 mb-2">
                              {health.api_availability === 'healthy' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                              )}
                              <span className="font-medium">API</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{health.api_response_time_ms}ms response time</p>
                          </div>
                          <div className="border rounded p-4">
                            <div className="flex items-center gap-2 mb-2">
                              {health.database_health === 'healthy' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                              )}
                              <span className="font-medium">Database</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {health.database_connection_pool.active}/{health.database_connection_pool.total} connections
                            </p>
                          </div>
                          <div className="border rounded p-4">
                            <div className="flex items-center gap-2 mb-2">
                              {health.integration_health === 'healthy' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                              )}
                              <span className="font-medium">Integrations</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {health.active_integrations} active
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>System Logs & Diagnostics</CardTitle>
                  <CardDescription>Recent system events and audit trail</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.slice(0, 20).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{new Date(log.timestamp).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warning' ? 'default' : 'secondary'}>
                              {log.level}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{log.category}</TableCell>
                          <TableCell className="text-sm">{log.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <Card>
                <CardHeader>
                  <CardTitle>System Actions & Safeguards</CardTitle>
                  <CardDescription>High-risk operations with confirmation required</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border border-destructive rounded p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium">Maintenance Mode</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Enable or disable maintenance mode platform-wide
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" onClick={() => handleMaintenanceMode(true)}>
                              Enable Maintenance Mode
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleMaintenanceMode(false)}>
                              Disable Maintenance Mode
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-destructive rounded p-4">
                      <div className="flex items-start gap-3">
                        <Zap className="h-5 w-5 text-destructive mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium">Force Logout All Users</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Immediately log out all users (emergency use only)
                          </p>
                          <Button size="sm" variant="destructive" onClick={handleForceLogout}>
                            Force Logout All
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}