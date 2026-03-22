// Create Breach Dialog

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { useDataComplianceStore } from '../store';
import type { BreachSeverity } from '../types';

interface CreateBreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBreachDialog({ open, onOpenChange }: CreateBreachDialogProps) {
  const { createBreach } = useDataComplianceStore();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium' as BreachSeverity,
    data_categories: [],
    affected_locations: [],
    estimated_affected_count: 0,
    discovery_date: new Date().toISOString().split('T')[0],
    notification_required: false,
    mitigation_actions: '',
  });

  const handleSubmit = async () => {
    await createBreach({
      ...formData,
      reported_by: 'current-user',
    });
    onOpenChange(false);
    setFormData({
      title: '',
      description: '',
      severity: 'medium',
      data_categories: [],
      affected_locations: [],
      estimated_affected_count: 0,
      discovery_date: new Date().toISOString().split('T')[0],
      notification_required: false,
      mitigation_actions: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Report Data Breach</DialogTitle>
          <DialogDescription>Document a data breach or security incident</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the breach"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(value: BreachSeverity) => setFormData({ ...formData, severity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Discovery Date</Label>
              <Input
                type="date"
                value={formData.discovery_date}
                onChange={(e) => setFormData({ ...formData, discovery_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of what happened..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Estimated Affected Count</Label>
            <Input
              type="number"
              value={formData.estimated_affected_count}
              onChange={(e) => setFormData({ ...formData, estimated_affected_count: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>Mitigation Actions</Label>
            <Textarea
              value={formData.mitigation_actions}
              onChange={(e) => setFormData({ ...formData, mitigation_actions: e.target.value })}
              placeholder="Steps taken or planned to mitigate the breach..."
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Notification Required</Label>
            <Switch
              checked={formData.notification_required}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, notification_required: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Report Breach</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
