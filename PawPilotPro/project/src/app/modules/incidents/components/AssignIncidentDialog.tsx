// Assign Incident Dialog - Assign incident to a user

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { toast } from 'sonner';
import { useIncidentsStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import type { Incident } from '../types';

interface AssignIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  incident: Incident;
  onSuccess?: () => void;
}

export function AssignIncidentDialog({ open, onClose, incident, onSuccess }: AssignIncidentDialogProps) {
  const { assignIncident, isLoading } = useIncidentsStore();
  const { users, fetchUsers } = useSettingsStore();

  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (open && users.length === 0) {
      fetchUsers().catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setAssignedToId(incident.assigned_to_id || '');
      setDueDate(incident.due_date ? incident.due_date.split('T')[0] : '');
    }
  }, [open, incident]);

  const handleSubmit = async () => {
    if (!assignedToId) {
      toast.error('Please select a user to assign');
      return;
    }

    const user = users.find(u => u.id === assignedToId);
    if (!user) {
      toast.error('Selected user not found');
      return;
    }

    try {
      await assignIncident(incident.id, {
        assigned_to_id: assignedToId,
        assigned_to_name: user.name,
        due_date: dueDate || undefined,
      });

      toast.success('Incident assigned successfully');
      onSuccess?.();
    } catch (err) {
      // Error handled by store
    }
  };

  const eligibleUsers = users.filter(u => 
    u.isActive && (u.role === 'admin' || u.role === 'manager' || u.role === 'assistant_manager' || u.role === 'staff')
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Incident</DialogTitle>
          <DialogDescription>
            Assign this incident to a user for follow-up action
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Assign To *</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Due Date (Optional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
