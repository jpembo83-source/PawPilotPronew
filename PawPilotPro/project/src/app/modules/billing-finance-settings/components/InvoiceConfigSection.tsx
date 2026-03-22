// Invoice Configuration Section - Billing & Finance Settings

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { useBillingFinanceSettingsStore } from '../store';
import type { InvoiceSettings, InvoiceTimingMode, InvoiceDueTerm } from '../types';

export function InvoiceConfigSection() {
  const { invoiceSettings, updateInvoiceSettings } = useBillingFinanceSettingsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InvoiceSettings>>({});

  const globalSettings = invoiceSettings.find((s) => s.location_id === null);

  const handleEdit = (settings: InvoiceSettings) => {
    setEditingId(settings.id);
    setFormData(settings);
  };

  const handleSave = async () => {
    if (!editingId) return;
    await updateInvoiceSettings(editingId, {
      ...formData,
      updated_by: 'current-user',
    });
    setEditingId(null);
    setFormData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
  };

  if (!globalSettings) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No invoice settings found. Configure your invoice settings to get started.
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEditing = editingId === globalSettings.id;
  const currentData = isEditing ? formData : globalSettings;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Invoice Configuration</CardTitle>
              <CardDescription>
                Control how invoices are created, numbered, and presented to customers
              </CardDescription>
            </div>
            {!isEditing && (
              <Button onClick={() => handleEdit(globalSettings)}>Edit Settings</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Numbering Format */}
          <div className="space-y-4">
            <h3 className="font-medium">Invoice Numbering</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefix">Prefix</Label>
                <Input
                  id="prefix"
                  value={currentData.numbering_format?.prefix || ''}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      numbering_format: {
                        ...formData.numbering_format!,
                        prefix: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sequence">Sequence</Label>
                <Select
                  value={currentData.numbering_format?.sequence || 'global'}
                  disabled={!isEditing}
                  onValueChange={(value: 'global' | 'per_location') =>
                    setFormData({
                      ...formData,
                      numbering_format: {
                        ...formData.numbering_format!,
                        sequence: value,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="per_location">Per Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_number">Next Number</Label>
                <Input
                  id="next_number"
                  type="number"
                  value={currentData.numbering_format?.next_number || 1000}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      numbering_format: {
                        ...formData.numbering_format!,
                        next_number: parseInt(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
            {!isEditing && (
              <div className="text-sm text-muted-foreground">
                Next invoice will be:{' '}
                <strong>
                  {currentData.numbering_format?.prefix}-{currentData.numbering_format?.next_number}
                </strong>
              </div>
            )}
          </div>

          {/* Timing */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Invoice Timing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timing_mode">Timing Mode</Label>
                <Select
                  value={currentData.timing?.mode || 'immediate'}
                  disabled={!isEditing}
                  onValueChange={(value: InvoiceTimingMode) =>
                    setFormData({
                      ...formData,
                      timing: {
                        ...formData.timing!,
                        mode: value,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate (per booking)</SelectItem>
                    <SelectItem value="monthly_consolidated">Monthly Consolidated</SelectItem>
                    <SelectItem value="hybrid">Hybrid (membership monthly + ad-hoc immediate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(currentData.timing?.mode === 'monthly_consolidated' || currentData.timing?.mode === 'hybrid') && (
                <div className="space-y-2">
                  <Label htmlFor="consolidation_day">Consolidation Day</Label>
                  <Input
                    id="consolidation_day"
                    type="number"
                    min="1"
                    max="28"
                    value={currentData.timing?.consolidation_day || 1}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        timing: {
                          ...formData.timing!,
                          consolidation_day: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Day of month (1-28)</p>
                </div>
              )}
            </div>
          </div>

          {/* Due Terms */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Payment Terms</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_terms">Due Terms</Label>
                <Select
                  value={currentData.due_terms || 'immediate'}
                  disabled={!isEditing}
                  onValueChange={(value: InvoiceDueTerm) =>
                    setFormData({
                      ...formData,
                      due_terms: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="net_7">Net 7 days</SelectItem>
                    <SelectItem value="net_14">Net 14 days</SelectItem>
                    <SelectItem value="net_30">Net 30 days</SelectItem>
                    <SelectItem value="net_60">Net 60 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_language">Default Language</Label>
                <Select
                  value={currentData.default_language || 'en'}
                  disabled={!isEditing}
                  onValueChange={(value: 'en' | 'de' | 'fr' | 'it') =>
                    setFormData({
                      ...formData,
                      default_language: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Invoice Footer</h3>
            <div className="space-y-2">
              <Label htmlFor="footer_text">Footer Text</Label>
              <Input
                id="footer_text"
                value={currentData.footer_text || ''}
                disabled={!isEditing}
                placeholder="Thank you for your business."
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    footer_text: e.target.value,
                  })
                }
              />
            </div>
          </div>

          {/* Actions */}
          {isEditing && (
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleSave}>Save Changes</Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            • Invoice numbering changes affect <strong>future invoices only</strong>. Historical invoice numbers are never changed.
          </p>
          <p>
            • Sequential numbering is enforced for audit compliance. Gaps in numbering are logged and tracked.
          </p>
          <p>
            • Location-specific invoice settings can be configured to override these global defaults.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}