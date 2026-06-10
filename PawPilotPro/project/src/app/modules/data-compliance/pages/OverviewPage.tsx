// Overview Dashboard - Data & Compliance

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Warning, FileText, Eye, Clock, Shield, Pulse } from '@phosphor-icons/react';
import { useDataComplianceStore } from '../store';

export function OverviewPage() {
  const { stats, requests, exports, breaches } = useDataComplianceStore();

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading compliance statistics...
      </div>
    );
  }

  const recentRequests = requests.slice(0, 5);
  const recentExports = exports.slice(0, 5);
  const openBreaches = breaches.filter((b) => ['open', 'under_investigation'].includes(b.status));

  return (
    <div className="space-y-6">
      {/* Statistics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open GDPR Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(stats.open_requests_by_type).reduce((a, b) => a + b, 0)}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {stats.open_requests_by_type.access > 0 && (
                <Badge variant="outline">Access: {stats.open_requests_by_type.access}</Badge>
              )}
              {stats.open_requests_by_type.erasure > 0 && (
                <Badge variant="outline">Erasure: {stats.open_requests_by_type.erasure}</Badge>
              )}
              {stats.open_requests_by_type.rectification > 0 && (
                <Badge variant="outline">Rectification: {stats.open_requests_by_type.rectification}</Badge>
              )}
              {stats.open_requests_by_type.restriction > 0 && (
                <Badge variant="outline">Restriction: {stats.open_requests_by_type.restriction}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sensitive Access Events</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sensitive_access_events_7_days}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 7 days ({stats.sensitive_access_events_30_days} in 30 days)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcoming_retention_jobs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.failed_retention_jobs > 0 ? (
                <span className="text-destructive">{stats.failed_retention_jobs} failed</span>
              ) : (
                'All jobs healthy'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Breaches</CardTitle>
            <Warning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open_breaches}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.open_breaches === 0 ? 'No active incidents' : 'Requires attention'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Pulse */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent GDPR Requests</CardTitle>
            <CardDescription>Latest data subject requests</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent requests
              </p>
            ) : (
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div key={request.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{request.household_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {request.request_type} • {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        request.status === 'completed' ? 'success' :
                        request.status === 'pending' ? 'secondary' : 'default'
                      }
                      className="capitalize"
                    >
                      {request.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Data Exports</CardTitle>
            <CardDescription>Latest compliance exports</CardDescription>
          </CardHeader>
          <CardContent>
            {recentExports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent exports
              </p>
            ) : (
              <div className="space-y-3">
                {recentExports.map((exp) => (
                  <div key={exp.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm capitalize">{exp.export_type} Export</p>
                      <p className="text-xs text-muted-foreground">
                        {exp.scope} • {new Date(exp.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        exp.status === 'ready' ? 'success' :
                        exp.status === 'generating' ? 'secondary' : 'default'
                      }
                      className="capitalize"
                    >
                      {exp.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open Breaches Alert */}
      {openBreaches.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" />
              Active Data Breaches Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openBreaches.map((breach) => (
                <div key={breach.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{breach.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Severity: <Badge variant={breach.severity === 'critical' ? 'destructive' : 'secondary'}>{breach.severity}</Badge>
                      {' • '} Reported: {new Date(breach.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={breach.status === 'open' ? 'destructive' : 'default'}
                    className="capitalize"
                  >
                    {breach.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance Health */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Health</CardTitle>
          <CardDescription>Overall data protection status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span>GDPR Request Handling</span>
              </div>
              <Badge variant="success">Operational</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pulse className="h-4 w-4 text-green-600" />
                <span>Access Monitoring</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span>Retention Automation</span>
              </div>
              <Badge variant="success">Scheduled</Badge>
            </div>
            {stats.last_settings_change && (
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Last settings change: {new Date(stats.last_settings_change).toLocaleString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
