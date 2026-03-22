// Tax Rule Dialog - Create/Edit Tax Rules

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { Checkbox } from '../../../../components/ui/checkbox';
import { useBillingFinanceSettingsStore } from '../../store';
import type { TaxRule } from '../../types';

interface TaxRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: TaxRule | null;
}

export function TaxRuleDialog({ open, onOpenChange, rule }: TaxRuleDialogProps) {
  const { createTaxRule, updateTaxRule } = useBillingFinanceSettingsStore();
  const [formData, setFormData] = useState<Partial<TaxRule>>({
    name: '',
    tax_type: 'VAT',
    rate: 7.7,
    service_categories: [],
    location_id: null,
    effective_from: new Date().toISOString().split('T')[0],
    effective_until: null,
    vat_number: '',
    is_active: true,
  });

  useEffect(() => {
    if (rule) {
      setFormData(rule);
    } else {
      setFormData({
        name: '',
        tax_type: 'VAT',
        rate: 7.7,
        service_categories: [],
        location_id: null,
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: null,
        vat_number: '',
        is_active: true,
      });
    }
  }, [rule, open]);

  const handleSave = async () => {
    if (rule) {
      await updateTaxRule(rule.id, { ...formData, updated_by: 'current-user' });
    } else {
      await createTaxRule({ ...formData, created_by: 'current-user' });
    }
    onOpenChange(false);
  };

  const serviceCategories = ['daycare', 'grooming', 'boutique', 'transport', 'overnights'];

  const toggleCategory = (category: string) => {
    const current = formData.service_categories || [];
    if (current.includes(category as any)) {
      setFormData({
        ...formData,
        service_categories: current.filter((c) => c !== category) as any,
      });
    } else {
      setFormData({
        ...formData,
        service_categories: [...current, category] as any,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Tax Rule' : 'Create Tax Rule'}</DialogTitle>
          <DialogDescription>
            Define tax rates for different service categories
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Standard VAT (Switzerland)"
              />
            </div>
            <div className="space-y-2">
              <Label>Tax Type</Label>
              <Select
                value={formData.tax_type}
                onValueChange={(value: 'VAT' | 'GST' | 'Sales_Tax') =>
                  setFormData({ ...formData, tax_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VAT">VAT</SelectItem>
                  <SelectItem value="GST">GST</SelectItem>
                  <SelectItem value="Sales_Tax">Sales Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>VAT/Tax Number (optional)</Label>
              <Input
                value={formData.vat_number || ''}
                onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                placeholder="CHE-123.456.789 MWST"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Service Categories</Label>
            <div className="grid grid-cols-3 gap-3">
              {serviceCategories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.service_categories?.includes(category as any)}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  <Label className="capitalize">{category}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input
                type="date"
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective Until (optional)</Label>
              <Input
                type="date"
                value={formData.effective_until || ''}
                onChange={(e) =>
                  setFormData({ ...formData, effective_until: e.target.value || null })
                }
              />
            </div>
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
          <Button onClick={handleSave}>
            {rule ? 'Update' : 'Create'} Tax Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
