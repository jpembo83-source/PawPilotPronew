import React from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { AuditLogViewer } from '../AuditLogViewer';

// The audit tab reads the REAL server audit trail (/settings/audit-logs,
// entries written by logAudit on every settings/user/template mutation) —
// not a client-side in-memory list that evaporated on reload.
export function AccessAudit() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
          <ClockCounterClockwise className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-slate-900">Access Audit Log</h3>
          <p className="text-sm text-slate-500">
            Server-recorded changes to settings, users, and permission templates.
          </p>
        </div>
      </div>

      <AuditLogViewer limit={50} showFilters />
    </div>
  );
}
