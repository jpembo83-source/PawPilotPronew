// Audit Logs Section - Communications Settings

import React, { useEffect, useState } from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { MagnifyingGlass, MagnifyingGlass, Clock, CheckCircle, XCircle, Warning } from '@phosphor-icons/react';

const actionColors = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  enabled: 'bg-green-100 text-green-700',
  disabled: 'bg-amber-100 text-amber-700',
  archived: 'bg-slate-100 text-slate-700',
};

const deliveryStatusIcons = {
  sent: CheckCircle,
  delivered: CheckCircle,
  failed: XCircle,
  bounced: Warning,
  queued: Clock,
  sending: Clock,
};

const deliveryStatusColors = {
  sent: 'text-blue-600',
  delivered: 'text-green-600',
  failed: 'text-red-600',
  bounced: 'text-amber-600',
  queued: 'text-slate-600',
  sending: 'text-blue-600',
};

export function AuditLogsSection() {
  const { 
    auditLogs, 
    deliveryLogs, 
    fetchAuditLogs, 
    fetchDeliveryLogs,
    auditLogFilters,
    deliveryLogFilters,
    setAuditLogFilters,
    setDeliveryLogFilters
  } = useCommunicationsSettingsStore();

  const [activeTab, setActiveTab] = useState('audit');

  useEffect(() => {
    if (activeTab === 'audit' && auditLogs.length === 0) {
      fetchAuditLogs();
    }
    if (activeTab === 'delivery' && deliveryLogs.length === 0) {
      fetchDeliveryLogs();
    }
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Audit & Logs</h3>
        <p className="text-sm text-slate-600 mt-1">
          View configuration changes and message delivery history
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="audit">
            Configuration Audit
            <Badge variant="secondary" className="ml-2">{auditLogs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="delivery">
            Delivery Logs
            <Badge variant="secondary" className="ml-2">{deliveryLogs.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Configuration Audit */}
        <TabsContent value="audit" className="space-y-3">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search logs..."
                    value={auditLogFilters.search || ''}
                    onChange={(e) => setAuditLogFilters({ search: e.target.value })}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={auditLogFilters.entityType || 'all'}
                  onValueChange={(value) => setAuditLogFilters({ entityType: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="channel">Channel</SelectItem>
                    <SelectItem value="sender_identity">Sender Identity</SelectItem>
                    <SelectItem value="consent_policy">Consent Policy</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="sla">SLA</SelectItem>
                    <SelectItem value="permission">Permission</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={auditLogFilters.action || 'all'}
                  onValueChange={(value) => setAuditLogFilters({ action: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="updated">Updated</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Audit Table */}
          {auditLogs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-slate-500">
                <MagnifyingGlass className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No audit logs found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Performed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.slice(0, 50).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-slate-600">
                        {new Date(log.performedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={(actionColors as any)[log.action] || 'bg-slate-100 text-slate-700'}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {log.entityType.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="font-medium">{log.entityName}</TableCell>
                      <TableCell className="text-sm">{log.performedByName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Delivery Logs */}
        <TabsContent value="delivery" className="space-y-3">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search logs..."
                    value={deliveryLogFilters.search || ''}
                    onChange={(e) => setDeliveryLogFilters({ search: e.target.value })}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={deliveryLogFilters.channel || 'all'}
                  onValueChange={(value) => setDeliveryLogFilters({ channel: value === 'all' ? undefined : value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={deliveryLogFilters.status || 'all'}
                  onValueChange={(value) => setDeliveryLogFilters({ status: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Table */}
          {deliveryLogs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-slate-500">
                <MagnifyingGlass className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No delivery logs found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Sent By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryLogs.slice(0, 50).map((log) => {
                    const StatusIcon = (deliveryStatusIcons as any)[log.status] || Clock;
                    const statusColor = (deliveryStatusColors as any)[log.status] || 'text-slate-600';
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-slate-600">
                          {new Date(log.queuedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                            <span className="text-sm capitalize">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{log.channel}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{log.recipientName}</TableCell>
                        <TableCell className="text-sm text-slate-600">{log.templateName || '-'}</TableCell>
                        <TableCell className="text-sm">{log.sentByName}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
