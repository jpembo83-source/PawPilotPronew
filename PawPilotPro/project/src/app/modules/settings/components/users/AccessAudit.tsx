import React from 'react';
import { useUserStore } from '../../stores/userStore';
import { format } from 'date-fns';
import { History, User } from 'lucide-react';

export function AccessAudit() {
  const { auditLog } = useUserStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-slate-900">Access Audit Log</h3>
          <p className="text-sm text-slate-500">Track all security and access changes.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Timestamp</th>
              <th className="px-6 py-3">Actor</th>
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Target</th>
              <th className="px-6 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLog.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No audit records found.
                </td>
              </tr>
            ) : (
              auditLog.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                    {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-slate-400" />
                      <span className="font-medium text-slate-900">{log.actorName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {log.targetName}
                  </td>
                  <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                    {log.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
