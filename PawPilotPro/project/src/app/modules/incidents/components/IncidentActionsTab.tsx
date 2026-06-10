// Incident Actions Tab - Manage action items/checklist

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Plus, CheckCircle, Circle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useIncidentsStore } from '../store';
import { useAuth } from '../../../context/AuthContext';
import type { Incident } from '../types';

interface IncidentActionsTabProps {
  incident: Incident;
  onUpdate: () => void;
}

export function IncidentActionsTab({ incident, onUpdate }: IncidentActionsTabProps) {
  const { user } = useAuth();
  const { addAction, updateAction, isLoading } = useIncidentsStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleAddAction = async () => {
    if (!description.trim()) {
      toast.error('Please provide action description');
      return;
    }

    try {
      await addAction(incident.id, {
        description: description.trim(),
        due_date: dueDate || undefined,
      });

      toast.success('Action added successfully');
      setDescription('');
      setDueDate('');
      setShowAddForm(false);
      onUpdate();
    } catch (err) {
      // Error handled by store
    }
  };

  const handleUpdateActionStatus = async (actionId: string, status: string) => {
    try {
      await updateAction(incident.id, actionId, { status });
      toast.success('Action updated');
      onUpdate();
    } catch (err) {
      // Error handled by store
    }
  };

  const canManageActions = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager';

  const actions = incident.actions || [];
  const pendingActions = actions.filter(a => a.status === 'pending' || a.status === 'in_progress');
  const completedActions = actions.filter(a => a.status === 'completed');

  return (
    <div className="space-y-4">
      {canManageActions && incident.status !== 'closed' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Add Action Item</CardTitle>
              {!showAddForm && (
                <Button size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Action
                </Button>
              )}
            </div>
          </CardHeader>
          {showAddForm && (
            <CardContent className="space-y-4">
              <div>
                <Label>Action Description *</Label>
                <Textarea
                  placeholder="Describe the action that needs to be taken..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label>Due Date (Optional)</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddAction} disabled={isLoading}>
                  Add Action
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setDescription('');
                    setDueDate('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {pendingActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Actions ({pendingActions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingActions.map((action) => (
                <div key={action.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    {action.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900">{action.description}</p>
                    {action.due_date && (
                      <p className="text-sm text-slate-600 mt-1">
                        Due: {new Date(action.due_date).toLocaleDateString('en-GB')}
                      </p>
                    )}
                    {action.assigned_to_name && (
                      <p className="text-sm text-slate-600 mt-1">
                        Assigned to: {action.assigned_to_name}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      Created {new Date(action.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  {canManageActions && incident.status !== 'closed' && (
                    <div>
                      <Select
                        value={action.status}
                        onValueChange={(status) => handleUpdateActionStatus(action.id, status)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {completedActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Actions ({completedActions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedActions.map((action) => (
                <div key={action.id} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg opacity-75">
                  <div className="flex-shrink-0 mt-0.5">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 line-through">{action.description}</p>
                    {action.completed_at && (
                      <p className="text-sm text-slate-600 mt-1">
                        Completed by {action.completed_by_name} on {new Date(action.completed_at).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {actions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            No action items yet
          </CardContent>
        </Card>
      )}
    </div>
  );
}
