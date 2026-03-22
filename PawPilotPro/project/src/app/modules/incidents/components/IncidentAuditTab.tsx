// Incident Audit Tab - Display audit trail

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import type { Incident } from '../types';

interface IncidentAuditTabProps {
  incident: Incident;
}

export function IncidentAuditTab({ incident }: IncidentAuditTabProps) {
  const auditLogs = incident.audit_logs || [];

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: 'Created',
      update: 'Updated',
      assign: 'Assigned',
      close: 'Closed',
      reopen: 'Reopened',
      auto_escalate: 'Auto-Escalated',
      add_note: 'Note Added',
      add_action: 'Action Added',
      update_action: 'Action Updated',
      view: 'Viewed',
    };
    return labels[action] || action;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail ({auditLogs.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No audit logs available</p>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {getActionLabel(log.action)}
                    </Badge>
                    <span className="text-sm font-medium text-slate-900">{log.user_name}</span>
                    <span className="text-xs text-slate-500">({log.user_role})</span>
                  </div>
                  {log.field_changed && (
                    <p className="text-sm text-slate-700 mt-1">
                      Changed <span className="font-medium">{log.field_changed}</span>
                      {log.old_value && log.new_value && (
                        <>
                          {' '}from <span className="font-mono text-xs bg-red-100 px-1 rounded">{log.old_value}</span>
                          {' '}to <span className="font-mono text-xs bg-green-100 px-1 rounded">{log.new_value}</span>
                        </>
                      )}
                    </p>
                  )}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="text-xs text-slate-600 mt-1">
                      {Object.entries(log.details).map(([key, value]) => (
                        <div key={key}>
                          <span className="capitalize">{key.replace('_', ' ')}</span>: {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(log.timestamp).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
