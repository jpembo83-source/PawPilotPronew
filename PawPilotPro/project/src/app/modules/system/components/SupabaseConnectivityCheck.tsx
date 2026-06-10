// Supabase Connectivity Validation Component
// Comprehensive health check for Supabase infrastructure

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { CheckCircle, XCircle, CircleNotch, Warning, Database, HardDrives, Shield, Lightning, ArrowClockwise } from '@phosphor-icons/react';
import { supabase } from '../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { toast } from 'sonner';

interface HealthCheck {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  duration?: number;
  icon: typeof Database;
}

export function SupabaseConnectivityCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [checks, setChecks] = useState<HealthCheck[]>([
    { name: 'Configuration', status: 'pending', message: 'Not checked', icon: HardDrives },
    { name: 'Authentication', status: 'pending', message: 'Not checked', icon: Shield },
    { name: 'Database Connection', status: 'pending', message: 'Not checked', icon: Database },
    { name: 'Edge Functions', status: 'pending', message: 'Not checked', icon: Lightning },
    { name: 'API Latency', status: 'pending', message: 'Not checked', icon: HardDrives },
  ]);

  const runHealthChecks = async () => {
    setIsChecking(true);
    const updatedChecks: HealthCheck[] = [...checks];
    
    try {
      // 1. Configuration Check
      const configStart = performance.now();
      try {
        if (!projectId || projectId === 'undefined') {
          throw new Error('Project ID not configured');
        }
        if (!publicAnonKey || publicAnonKey === 'undefined') {
          throw new Error('Anon key not configured');
        }
        updatedChecks[0] = {
          name: 'Configuration',
          status: 'success',
          message: `Project: ${projectId.substring(0, 8)}...`,
          duration: performance.now() - configStart,
          icon: HardDrives
        };
      } catch (error) {
        updatedChecks[0] = {
          name: 'Configuration',
          status: 'error',
          message: error instanceof Error ? error.message : 'Invalid configuration',
          icon: HardDrives
        };
      }
      setChecks([...updatedChecks]);

      // 2. Authentication Check
      const authStart = performance.now();
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }
        
        if (sessionData?.session) {
          updatedChecks[1] = {
            name: 'Authentication',
            status: 'success',
            message: `Authenticated as ${sessionData.session.user.email}`,
            duration: performance.now() - authStart,
            icon: Shield
          };
        } else {
          updatedChecks[1] = {
            name: 'Authentication',
            status: 'warning',
            message: 'No active session',
            duration: performance.now() - authStart,
            icon: Shield
          };
        }
      } catch (error) {
        updatedChecks[1] = {
          name: 'Authentication',
          status: 'error',
          message: error instanceof Error ? error.message : 'Auth check failed',
          icon: Shield
        };
      }
      setChecks([...updatedChecks]);

      // 3. Database Connection Check
      const dbStart = performance.now();
      try {
        // Try to query the KV store to test database connectivity
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No access token available');
        }

        const testResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/kv/test-connection`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (testResponse.ok) {
          updatedChecks[2] = {
            name: 'Database Connection',
            status: 'success',
            message: 'KV store accessible',
            duration: performance.now() - dbStart,
            icon: Database
          };
        } else {
          const errorText = await testResponse.text();
          updatedChecks[2] = {
            name: 'Database Connection',
            status: 'warning',
            message: `Response: ${testResponse.status}`,
            duration: performance.now() - dbStart,
            icon: Database
          };
        }
      } catch (error) {
        updatedChecks[2] = {
          name: 'Database Connection',
          status: 'error',
          message: error instanceof Error ? error.message : 'Connection failed',
          icon: Database
        };
      }
      setChecks([...updatedChecks]);

      // 4. Edge Functions Check
      const edgeStart = performance.now();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No access token for edge functions test');
        }

        const healthResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/health`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          updatedChecks[3] = {
            name: 'Edge Functions',
            status: 'success',
            message: healthData.status || 'Functions operational',
            duration: performance.now() - edgeStart,
            icon: Lightning
          };
        } else {
          updatedChecks[3] = {
            name: 'Edge Functions',
            status: 'warning',
            message: `HTTP ${healthResponse.status}`,
            duration: performance.now() - edgeStart,
            icon: Lightning
          };
        }
      } catch (error) {
        updatedChecks[3] = {
          name: 'Edge Functions',
          status: 'error',
          message: error instanceof Error ? error.message : 'Edge functions unreachable',
          icon: Lightning
        };
      }
      setChecks([...updatedChecks]);

      // 5. API Latency Check
      const latencyStart = performance.now();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No access token for latency test');
        }

        const pingStart = performance.now();
        const pingResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/health`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );
        const latency = performance.now() - pingStart;

        if (pingResponse.ok) {
          const status = latency < 200 ? 'success' : latency < 500 ? 'warning' : 'error';
          updatedChecks[4] = {
            name: 'API Latency',
            status,
            message: `${Math.round(latency)}ms response time`,
            duration: performance.now() - latencyStart,
            icon: HardDrives
          };
        } else {
          updatedChecks[4] = {
            name: 'API Latency',
            status: 'error',
            message: 'Unable to measure',
            icon: HardDrives
          };
        }
      } catch (error) {
        updatedChecks[4] = {
          name: 'API Latency',
          status: 'error',
          message: error instanceof Error ? error.message : 'Latency check failed',
          icon: HardDrives
        };
      }
      setChecks([...updatedChecks]);

      setLastCheckTime(new Date());
      
      // Show summary toast
      const failedChecks = updatedChecks.filter(c => c.status === 'error').length;
      const warningChecks = updatedChecks.filter(c => c.status === 'warning').length;
      
      if (failedChecks === 0 && warningChecks === 0) {
        toast.success('All connectivity checks passed');
      } else if (failedChecks > 0) {
        toast.error(`${failedChecks} check(s) failed`);
      } else {
        toast.warning(`${warningChecks} check(s) have warnings`);
      }

    } catch (error) {
      toast.error('Health check failed');
      console.error('Supabase health check error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <Warning className="h-5 w-5 text-orange-600" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-slate-300" />;
    }
  };

  const getStatusBadge = (status: HealthCheck['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Healthy</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      case 'warning':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Warning</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const overallStatus = checks.every(c => c.status === 'success' || c.status === 'pending')
    ? 'success'
    : checks.some(c => c.status === 'error')
    ? 'error'
    : 'warning';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Supabase Connectivity
            </CardTitle>
            <CardDescription>
              Comprehensive validation of Supabase infrastructure and API connectivity
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {lastCheckTime && (
              <span className="text-xs text-muted-foreground">
                Last check: {lastCheckTime.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={runHealthChecks}
              disabled={isChecking}
              size="sm"
              variant={overallStatus === 'error' ? 'destructive' : overallStatus === 'warning' ? 'default' : 'outline'}
            >
              {isChecking ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <ArrowClockwise className="h-4 w-4 mr-2" />
                  Run Health Check
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map((check, index) => {
            const Icon = check.icon;
            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{check.name}</div>
                    <div className="text-xs text-muted-foreground">{check.message}</div>
                    {check.duration !== undefined && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {check.duration.toFixed(0)}ms
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  {getStatusBadge(check.status)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
          <div className="flex items-start gap-3">
            {overallStatus === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : overallStatus === 'error' ? (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            ) : (
              <Warning className="h-5 w-5 text-orange-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">
                {overallStatus === 'success'
                  ? 'All Systems Operational'
                  : overallStatus === 'error'
                  ? 'Critical Issues Detected'
                  : 'Some Issues Detected'}
              </h4>
              <p className="text-xs text-muted-foreground">
                {overallStatus === 'success'
                  ? 'Your Supabase infrastructure is healthy and all connectivity checks passed.'
                  : overallStatus === 'error'
                  ? 'Critical connectivity issues detected. The application may not function correctly until these are resolved.'
                  : 'Some checks returned warnings. The application may experience degraded performance.'}
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Info */}
        <div className="mt-4 p-4 border rounded-lg">
          <h4 className="font-medium text-sm mb-2">Configuration</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Project ID:</span>
              <div className="font-mono mt-1">{projectId?.substring(0, 20)}...</div>
            </div>
            <div>
              <span className="text-muted-foreground">API Endpoint:</span>
              <div className="font-mono mt-1 truncate">
                {projectId ? `${projectId}.supabase.co` : 'Not configured'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}