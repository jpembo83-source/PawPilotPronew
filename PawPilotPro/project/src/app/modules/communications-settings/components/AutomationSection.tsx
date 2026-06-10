// Automation Section - Communications Settings

import React, { useState } from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Switch } from '../../../components/ui/switch';
import { Plus, Lightning, PencilSimple, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { AutomationRuleDialog } from './modals/AutomationRuleDialog';
import type { AutomationRule } from '../types';

const statusColors = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  disabled: 'bg-slate-100 text-slate-700',
};

export function AutomationSection() {
  const { automationRules, updateAutomationRule, deleteAutomationRule } = useCommunicationsSettingsStore();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await updateAutomationRule(rule.id, {
        isEnabled: !rule.isEnabled,
        updatedBy: user?.id || 'unknown',
        updatedByName: user?.name || 'Unknown User',
      });
      toast.success(`Automation ${!rule.isEnabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    
    try {
      await deleteAutomationRule(id);
      toast.success('Automation rule deleted');
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Automation & Triggers</h3>
          <p className="text-sm text-slate-600 mt-1">
            Define when messages are sent automatically based on operational events
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Automation
        </Button>
      </div>

      {/* Rules List */}
      {automationRules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            <Lightning className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No automation rules configured</p>
            <p className="text-xs mt-1">Create automation rules to send messages automatically</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {automationRules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-slate-900">{rule.name}</h4>
                      <Badge className={statusColors[rule.status]}>{rule.status}</Badge>
                      <Badge variant="outline" className="capitalize">{rule.module}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{rule.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-xs text-slate-500">Event:</span>
                        <p className="font-medium">{rule.event.replace(/_/g, ' ')}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Template:</span>
                        <p className="font-medium">{rule.templateName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Timing:</span>
                        <p className="font-medium capitalize">{rule.sendTiming}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Messages Sent:</span>
                        <p className="font-medium">{rule.messagesSent}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>Channels:</span>
                      {rule.channels.map(ch => (
                        <Badge key={ch} variant="secondary" className="capitalize text-xs">{ch}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isEnabled}
                      onCheckedChange={() => handleToggle(rule)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                      <PencilSimple className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                      <Trash className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <AutomationRuleDialog 
        open={dialogOpen}
        onClose={handleClose}
        rule={editingRule}
      />
    </div>
  );
}
