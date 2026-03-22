// Create Request Dialog

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { Checkbox } from '../../../components/ui/checkbox';
import { useDataComplianceStore } from '../store';
import type { RequestType, RequestSource, DataCategory } from '../types';

interface CreateRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRequestDialog({ open, onOpenChange }: CreateRequestDialogProps) {
  const { createRequest } = useDataComplianceStore();
  const [formData, setFormData] = useState({
    request_type: 'access' as RequestType,
    request_source: 'customer' as RequestSource,
    household_id: '',
    household_name: '',
    data_categories: [] as DataCategory[],
    scope_description: '',
  });

  const handleSubmit = async () => {
    await createRequest({
      ...formData,
      created_by: 'current-user',
    });
    onOpenChange(false);
    setFormData({
      request_type: 'access',
      request_source: 'customer',
      household_id: '',
      household_name: '',
      data_categories: [],
      scope_description: '',
    });
  };

  const categories: DataCategory[] = ['personal', 'medical', 'behavioural', 'financial', 'operational'];

  const toggleCategory = (cat: DataCategory) => {
    if (formData.data_categories.includes(cat)) {
      setFormData({ ...formData, data_categories: formData.data_categories.filter((c) => c !== cat) });
    } else {
      setFormData({ ...formData, data_categories: [...formData.data_categories, cat] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Data Subject Request</DialogTitle>
          <DialogDescription>
            Handle GDPR requests for access, rectification, erasure, or restriction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select
                value={formData.request_type}
                onValueChange={(value: RequestType) =>
                  setFormData({ ...formData, request_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="access">Right of Access</SelectItem>
                  <SelectItem value="rectification">Right to Rectification</SelectItem>
                  <SelectItem value="erasure">Right to Erasure</SelectItem>
                  <SelectItem value="restriction">Restriction of Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Request Source</Label>
              <Select
                value={formData.request_source}
                onValueChange={(value: RequestSource) =>
                  setFormData({ ...formData, request_source: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="regulator">Regulator</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Household Name</Label>
              <Input
                value={formData.household_name}
                onChange={(e) => setFormData({ ...formData, household_name: e.target.value })}
                placeholder="Smith Family"
              />
            </div>
            <div className="space-y-2">
              <Label>Household ID</Label>
              <Input
                value={formData.household_id}
                onChange={(e) => setFormData({ ...formData, household_id: e.target.value })}
                placeholder="household-001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data Categories</Label>
            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.data_categories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                  />
                  <Label className="capitalize">{cat}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scope Description</Label>
            <Textarea
              value={formData.scope_description}
              onChange={(e) => setFormData({ ...formData, scope_description: e.target.value })}
              placeholder="Describe what data is requested..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
