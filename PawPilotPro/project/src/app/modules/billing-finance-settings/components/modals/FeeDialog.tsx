// Fee Dialog - Create/Edit Fee Definitions

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { Textarea } from '../../../../components/ui/textarea';
import { useBillingFinanceSettingsStore } from '../../store';
import type { FeeDefinition } from '../../types';

interface FeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee: FeeDefinition | null;
}

export function FeeDialog({ open, onOpenChange, fee }: FeeDialogProps) {
  const { createFee, updateFee } = useBillingFinanceSettingsStore();
  const [formData, setFormData] = useState<Partial<FeeDefinition>>({
    fee_type: 'late_pickup',
    name: '',
    description: '',
    calculation_method: 'fixed',
    amount: 0,
    location_id: null,
    requires_approval_to_waive: false,
    is_active: true,
  });

  useEffect(() => {
    if (fee) {
      setFormData(fee);
    } else {
      setFormData({
        fee_type: 'late_pickup',
        name: '',
        description: '',
        calculation_method: 'fixed',
        amount: 0,
        location_id: null,
        requires_approval_to_waive: false,
        is_active: true,
      });
    }
  }, [fee, open]);

  const handleSave = async () => {
    if (fee) {
      await updateFee(fee.id, { ...formData, updated_by: 'current-user' });
    } else {
      await createFee({ ...formData, created_by: 'current-user' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fee ? 'Edit Fee' : 'Create Fee'}</DialogTitle>
          <DialogDescription>
            Define a fee that can be applied to bookings and invoices
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fee Type</Label>
              <Select
                value={formData.fee_type}
                onValueChange={(value: any) => setFormData({ ...formData, fee_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="late_pickup">Late Pickup</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                  <SelectItem value="late_cancellation">Late Cancellation</SelectItem>
                  <SelectItem value="transport_failure">Transport Failure</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Late Pickup Fee"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe when this fee applies"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Calculation Method</Label>
              <Select
                value={formData.calculation_method}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, calculation_method: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="per_minute">Per Minute</SelectItem>
                  <SelectItem value="per_block">Per Time Block</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          {formData.calculation_method === 'per_block' && (
            <div className="space-y-2">
              <Label>Block Size (Minutes)</Label>
              <Input
                type="number"
                value={formData.block_size_minutes || 15}
                onChange={(e) =>
                  setFormData({ ...formData, block_size_minutes: parseInt(e.target.value) })
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Grace Period (Minutes)</Label>
            <Input
              type="number"
              value={formData.grace_period_minutes || 0}
              onChange={(e) =>
                setFormData({ ...formData, grace_period_minutes: parseInt(e.target.value) || undefined })
              }
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.requires_approval_to_waive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requires_approval_to_waive: checked })
              }
            />
            <Label>Requires Approval to Waive</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label>Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{fee ? 'Update' : 'Create'} Fee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
