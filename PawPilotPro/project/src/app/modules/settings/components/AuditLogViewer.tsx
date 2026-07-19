// ============================================================================
// AUDIT LOG VIEWER
// ============================================================================
// Component to view audit logs for settings changes

import React, { useState, useEffect } from 'react';
import { FileText, Clock, User, Shield, Warning } from '@phosphor-icons/react';
import { projectId } from '../../../../../utils/supabase/info';
import { SettingsSection } from '../types/permissions';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  section: SettingsSection;
  action: string;
  resourceId?: string;
  details: Record<string, any>;
  before?: any;
  after?: any;
}

interface AuditLogViewerProps {
  section?: SettingsSection;
  limit?: number;
  showFilters?: boolean;
}

export function AuditLogViewer({ 
  section, 
  limit = 50,
  showFilters = true 
}: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  // Simple paging: each "Load more" re-fetches with a larger window.
  const [pageLimit, setPageLimit] = useState(limit);

  useEffect(() => {
    fetchLogs();
  }, [section, pageLimit]);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const url = section
        ? `${API_URL}/settings/audit-logs?section=${section}&limit=${pageLimit}`
        : `${API_URL}/settings/audit-logs?limit=${pageLimit}`;

      const res = await fetch(url, {
        headers: await getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      } else {
        setError('Failed to fetch audit logs');
      }
    } catch (e) {
      console.error('Error fetching audit logs:', e);
      setError('Error loading logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (roleFilter !== 'all' && log.userRole !== roleFilter) return false;
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    return true;
  });

  const getRiskLevelColor = (action: string) => {
    if (action === 'delete') return 'text-red-600';
    if (action === 'create') return 'text-green-600';
    if (action === 'update') return 'text-amber-600';
    return 'text-blue-600';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
        <Warning className="h-5 w-5 text-red-600" />
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Filter by Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="assistant_manager">Assistant Manager</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Filter by Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
              >
                <option value="all">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="view">View</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Section
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    No audit logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => (
                  <tr 
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="h-4 w-4" />
                        {formatTimestamp(entry.timestamp)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-900">{entry.userName}</div>
                          <div className="text-xs text-slate-500 capitalize">{entry.userRole}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium capitalize">
                        {entry.section}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium capitalize ${getRiskLevelColor(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {entry.resourceId && (
                        <div className="text-xs font-mono bg-slate-50 px-2 py-1 rounded">
                          ID: {entry.resourceId.substring(0, 8)}...
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {logs.length >= pageLimit && (
          <div className="border-t border-slate-200 p-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Showing {filteredLogs.length} of at least {logs.length} entries
            </span>
            <button
              onClick={() => setPageLimit((prev) => prev + limit)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium text-slate-700"
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Audit Log Details</h3>
              <p className="text-sm text-slate-500 mt-1">
                {formatTimestamp(selectedEntry.timestamp)}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase">User</label>
                <p className="mt-1 text-sm text-slate-900">{selectedEntry.userName} ({selectedEntry.userRole})</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase">Action</label>
                <p className="mt-1 text-sm text-slate-900 capitalize">{selectedEntry.action} on {selectedEntry.section}</p>
              </div>
              {selectedEntry.before && (
                <div>
                  <label className="text-xs font-medium text-slate-600 uppercase">Before</label>
                  <pre className="mt-1 text-xs bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto">
                    {JSON.stringify(selectedEntry.before, null, 2)}
                  </pre>
                </div>
              )}
              {selectedEntry.after && (
                <div>
                  <label className="text-xs font-medium text-slate-600 uppercase">After</label>
                  <pre className="mt-1 text-xs bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto">
                    {JSON.stringify(selectedEntry.after, null, 2)}
                  </pre>
                </div>
              )}
              {Object.keys(selectedEntry.details).length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-600 uppercase">Additional Details</label>
                  <pre className="mt-1 text-xs bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto">
                    {JSON.stringify(selectedEntry.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}