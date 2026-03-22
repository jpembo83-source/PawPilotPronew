// View As Management - MDC Operations Centre
// Monitor and audit View As sessions

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Eye, Clock, Shield, AlertTriangle, Server } from 'lucide-react';
import { BackendStatus } from '../../components/BackendStatus';
import * as viewAsApi from './api';
import type { ViewAsSession, ViewAsAuditLog } from './types';

export function ViewAsManagement() {
  const [sessions, setSessions] = useState<ViewAsSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<ViewAsAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sessionsData, auditData] = await Promise.all([
        viewAsApi.getSessions(),
        viewAsApi.getAuditLogs(),
      ]);
      setSessions(sessionsData);
      setAuditLogs(auditData);
    } catch (error) {
      console.error('Failed to load View As data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      await viewAsApi.seedData();
      await loadData();
    } catch (error) {
      console.error('Failed to seed data:', error);
    }
  };

  const activeSessions = sessions.filter(s => s.is_active);
  const completedSessions = sessions.filter(s => !s.is_active);

  const calculateDuration = (session: ViewAsSession) => {
    const start = new Date(session.started_at);
    const end = session.ended_at ? new Date(session.ended_at) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    return minutes < 1 ? '< 1 min' : `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      <BackendStatus />
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">View As Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Monitor and audit all View As activity
          </p>
        </div>
        <Button onClick={handleSeed} variant="outline" size="sm">
          Seed Data
        </Button>
      </div>

      {!isLoading && sessions.length === 0 && auditLogs.length === 0 && (
        <Alert>
          <Server className="h-4 w-4" />
          <AlertDescription>
            No View As sessions found. Click "Seed Data" to create sample users and test the View As functionality.
            <br />
            <span className="text-xs text-muted-foreground">Note: The backend must be deployed for this feature to work.</span>
          </AlertDescription>
        </Alert>
      )}

      {activeSessions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription className="text-orange-700">
              {activeSessions.length} user{activeSessions.length !== 1 ? 's are' : ' is'} currently viewing as another user
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeSessions.map(session => (
                <div key={session.id} className="bg-white rounded border border-orange-200 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Eye className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {session.viewer_user_name} viewing as {session.view_as_user_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Started {new Date(session.started_at).toLocaleString()} • {calculateDuration(session)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-orange-600">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Session History</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>Complete history of all View As sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Viewer</TableHead>
                    <TableHead>Viewed As</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedSessions.slice(0, 50).map(session => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{session.viewer_user_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{session.viewer_role}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{session.view_as_user_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{session.view_as_user_role}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(session.started_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {calculateDuration(session)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {session.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.is_active ? 'default' : 'secondary'}>
                          {session.is_active ? 'Active' : 'Ended'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {completedSessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No session history available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Detailed activity log of all View As actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Viewer</TableHead>
                    <TableHead>Target User</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.slice(0, 100).map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          log.action === 'session_started' ? 'default' :
                          log.action === 'action_blocked' ? 'destructive' :
                          'secondary'
                        } className="capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.viewer_user_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.view_as_user_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {auditLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No audit logs available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}