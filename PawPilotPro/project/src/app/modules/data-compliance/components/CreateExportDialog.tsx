// Create Export Dialog

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { toast } from 'sonner';
import { useDataComplianceStore } from '../store';
import type { DataExport, ExportFormat, ExportScope, DataCategory } from '../types';

interface CreateExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateExportDialog({ open, onOpenChange }: CreateExportDialogProps) {
  const { createExport } = useDataComplianceStore();
  const emptyForm = {
    export_type: 'customer' as DataExport['export_type'],
    scope: 'household' as ExportScope,
    format: 'json' as ExportFormat,
    scope_id: '',
    scope_description: '',
    data_categories: [] as DataCategory[],
  };
  const [formData, setFormData] = useState(emptyForm);

  const handleSubmit = async () => {
    const created = await createExport({
      ...formData,
      created_by: 'current-user',
    });
    if (!created) {
      toast.error('Export failed — check the household ID and try again');
      return;
    }
    toast.success(`Export ready: ${created.total_records ?? 0} records gathered`);
    onOpenChange(false);
    setFormData(emptyForm);
  };

  const categories: DataCategory[] = ['personal', 'medical', 'behavioural', 'financial', 'operational'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Data Export</DialogTitle>
          <DialogDescription>Export data securely with password protection</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Export Type</Label>
              <Select
                value={formData.export_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, export_type: value as DataExport['export_type'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer Data</SelectItem>
                  <SelectItem value="pet">Pet Records</SelectItem>
                  <SelectItem value="operational">Operational Data</SelectItem>
                  <SelectItem value="financial">Financial Data</SelectItem>
                  <SelectItem value="audit">Audit Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={formData.scope}
                onValueChange={(value: ExportScope) => setFormData({ ...formData, scope: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="household">Single Household</SelectItem>
                  <SelectItem value="location" disabled>Location (not yet supported)</SelectItem>
                  <SelectItem value="organisation" disabled>Organisation-wide (not yet supported)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={formData.format}
              onValueChange={(value: ExportFormat) => setFormData({ ...formData, format: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (+ readable summary)</SelectItem>
                <SelectItem value="csv" disabled>CSV (not yet supported)</SelectItem>
                <SelectItem value="pdf" disabled>PDF (not yet supported)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Household ID (data subject)</Label>
            <Input
              value={formData.scope_id}
              onChange={(e) => setFormData({ ...formData, scope_id: e.target.value })}
              placeholder="e.g., household-001"
            />
            <p className="text-sm text-muted-foreground">
              The export gathers every record held for this household across
              the whole app.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Scope Description</Label>
            <Input
              value={formData.scope_description}
              onChange={(e) => setFormData({ ...formData, scope_description: e.target.value })}
              placeholder="e.g., Smith Family - All Data"
            />
          </div>

          <div className="space-y-2">
            <Label>Data Categories</Label>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.data_categories.includes(cat)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, data_categories: [...formData.data_categories, cat] });
                      } else {
                        setFormData({ ...formData, data_categories: formData.data_categories.filter((c) => c !== cat) });
                      }
                    }}
                  />
                  <Label className="capitalize">{cat}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formData.scope_id.trim()}>
            Create Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
