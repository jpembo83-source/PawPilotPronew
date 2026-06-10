import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Badge } from '../../../components/ui/badge';
import { ClockCounterClockwise, Warning } from '@phosphor-icons/react';
import { useOperationalRulesStore } from '../store';
import { fetchAuditLog } from '../api';
import { toast } from 'sonner';
import type { RuleAudit } from '../types';

interface AuditLogModalProps {
  open: boolean;
  onClose: () => void;
  ruleId?: string;
}

export function AuditLogModal({ open, onClose, ruleId }: AuditLogModalProps) {
  const { auditLog, setAuditLog } = useOperationalRulesStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadAuditLog();
    }
  }, [open, ruleId]);

  const loadAuditLog = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAuditLog({ ruleId, limit: 100 });
      setAuditLog(data.audits);
    } catch (error: any) {
      console.error('Failed to load audit log:', error);
      toast.error('Failed to load audit log');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-green-100 text-green-700';
      case 'updated':
        return 'bg-blue-100 text-blue-700';
      case 'enabled':
        return 'bg-green-100 text-green-700';
      case 'disabled':
        return 'bg-amber-100 text-amber-700';
      case 'deleted':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClockCounterClockwise className="h-5 w-5" />
            Audit Log
          </DialogTitle>
          <DialogDescription>
            View the audit log for this rule to see changes and actions performed.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[600px]">
          {isLoading ? (
            <div className="text-center py-12 text-slate-600">
              Loading audit log...
            </div>
          ) : auditLog.length === 0 ? (
            <div className="text-center py-12">
              <Warning className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-600">No audit entries found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditLog.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={getActionColor(entry.action)}>
                          {entry.action}
                        </Badge>
                        <h4 className="font-medium">{entry.ruleName}</h4>
                      </div>
                      <p className="text-sm text-slate-600">
                        {entry.performedByName} • {new Date(entry.performedAt).toLocaleString('en-GB')}
                      </p>
                    </div>
                  </div>

                  {entry.reason && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                      <span className="font-medium text-amber-900">Reason:</span>{' '}
                      <span className="text-amber-700">{entry.reason}</span>
                    </div>
                  )}

                  {entry.before && entry.after && entry.action === 'updated' && (
                    <div className="mt-3 text-xs">
                      <details className="cursor-pointer">
                        <summary className="font-medium text-slate-700">View changes</summary>
                        <div className="mt-2 p-2 bg-slate-50 rounded font-mono text-xs">
                          <pre>{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}