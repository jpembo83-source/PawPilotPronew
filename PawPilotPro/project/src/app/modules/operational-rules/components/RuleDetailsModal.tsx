import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useOperationalRulesStore } from '../store';
import { updateRule, deleteRule } from '../api';
import { toast } from 'sonner';
import type { OperationalRule } from '../types';

interface RuleDetailsModalProps {
  rule: OperationalRule;
  onClose: () => void;
  onSuccess: () => void;
}

export function RuleDetailsModal({ rule, onClose, onSuccess }: RuleDetailsModalProps) {
  const { user, hasPermission } = useAuth();
  const { updateRule: updateRuleInStore, deleteRule: deleteRuleFromStore } = useOperationalRulesStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const canEdit = hasPermission('operational_rules', 'update');
  const canDelete = hasPermission('operational_rules', 'delete');

  const handleToggleStatus = async () => {
    const newStatus = rule.status === 'active' ? 'disabled' : 'active';
    const reason = newStatus === 'disabled' 
      ? prompt('Please provide a reason for disabling this rule:')
      : undefined;

    if (newStatus === 'disabled' && !reason) {
      toast.error('Reason is required when disabling a rule');
      return;
    }

    try {
      setIsUpdating(true);
      const updated = await updateRule(rule.id, {
        status: newStatus,
        updatedBy: user!.id,
        updatedByName: user!.user_metadata?.name || user!.email || 'Unknown',
        auditReason: reason,
        disabledReason: reason
      });

      updateRuleInStore(rule.id, updated);
      toast.success(`Rule ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
      return;
    }

    const reason = prompt('Please provide a reason for deleting this rule:');
    if (!reason) {
      toast.error('Reason is required when deleting a rule');
      return;
    }

    try {
      setIsUpdating(true);
      await deleteRule(
        rule.id,
        user!.id,
        user!.user_metadata?.name || user!.email || 'Unknown',
        reason
      );

      deleteRuleFromStore(rule.id);
      toast.success('Rule deleted');
      onClose();
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle>{rule.name}</DialogTitle>
              {rule.description && (
                <p className="text-sm text-slate-600 mt-1">{rule.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleStatus}
                  disabled={isUpdating}
                >
                  {rule.status === 'active' ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Enable
                    </>
                  )}
                </Button>
              )}
              
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isUpdating}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Module</label>
              <div className="mt-1">
                <Badge variant="outline">{rule.module}</Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Category</label>
              <div className="mt-1">
                <Badge variant="outline">{rule.category}</Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Type</label>
              <div className="mt-1">
                <Badge variant="outline">{rule.type}</Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Scope</label>
              <div className="mt-1">
                <Badge variant="outline">
                  {rule.scope === 'organisation' ? 'Organisation-wide' : rule.scopeName}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Status</label>
              <div className="mt-1">
                <Badge
                  variant={rule.status === 'active' ? 'default' : 'secondary'}
                  className={
                    rule.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : rule.status === 'disabled'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-amber-100 text-amber-700'
                  }
                >
                  {rule.status}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Priority</label>
              <div className="mt-1 text-sm">{rule.priority}</div>
            </div>
          </div>

          <Separator />

          {/* Event trigger */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Event Trigger</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="font-mono text-xs">
                {rule.event}
              </Badge>
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Conditions ({rule.conditions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {rule.conditions.length === 0 ? (
                <p className="text-sm text-slate-500">No conditions defined</p>
              ) : (
                <div className="space-y-2">
                  {rule.conditions.map((condition, idx) => (
                    <div key={condition.id} className="p-3 border rounded-lg bg-slate-50">
                      <div className="text-sm">
                        <span className="font-medium">{condition.field}</span>
                        {' '}<span className="text-slate-500">{condition.operator}</span>{' '}
                        <span className="font-mono">{JSON.stringify(condition.value)}</span>
                      </div>
                      {condition.description && (
                        <p className="text-xs text-slate-600 mt-1">{condition.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Actions ({rule.actions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {rule.actions.length === 0 ? (
                <p className="text-sm text-slate-500">No actions defined</p>
              ) : (
                <div className="space-y-2">
                  {rule.actions.map((action, idx) => (
                    <div key={action.id} className="p-3 border rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{action.type}</Badge>
                      </div>
                      {action.message && (
                        <p className="text-sm">{action.message}</p>
                      )}
                      {action.notifyRoles && action.notifyRoles.length > 0 && (
                        <p className="text-xs text-slate-600 mt-1">
                          Notify: {action.notifyRoles.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit info */}
          <div className="text-xs text-slate-500 space-y-1">
            <p>Created {new Date(rule.createdAt).toLocaleString('en-GB')} by {rule.createdByName}</p>
            <p>Last modified {new Date(rule.updatedAt).toLocaleString('en-GB')} by {rule.updatedByName}</p>
            {rule.disabledAt && rule.disabledReason && (
              <p className="text-amber-600">
                Disabled: {rule.disabledReason} ({new Date(rule.disabledAt).toLocaleString('en-GB')})
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}