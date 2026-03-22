// Audit & Controls Section

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { useBillingFinanceSettingsStore } from '../store';

export function AuditControlsSection() {
  const { auditControls, auditLogs, updateAuditControls } = useBillingFinanceSettingsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(auditControls);

  const handleSave = async () => {
    if (formData) {
      await updateAuditControls({ ...formData, updated_by: 'current-user' });
      setIsEditing(false);
    }
  };

  if (!auditControls) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No audit controls found. Use "Seed Data" to create defaults.
        </CardContent>
      </Card>
    );
  }

  const currentData = isEditing ? formData : auditControls;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Controls</CardTitle>
              <CardDescription>
                Configure financial data protection and compliance controls
              </CardDescription>
            </div>
            {!isEditing && (
              <Button onClick={() => { setFormData(auditControls); setIsEditing(true); }}>
                Edit Controls
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Invoice Soft Lock</Label>
              <p className="text-sm text-muted-foreground">
                Prevent invoice edits after specified days
              </p>
            </div>
            <Switch
              checked={currentData?.invoice_soft_lock_enabled || false}
              disabled={!isEditing}
              onCheckedChange={(checked) =>
                setFormData({ ...formData!, invoice_soft_lock_enabled: checked })
              }
            />
          </div>

          {currentData?.invoice_soft_lock_enabled && (
            <div className="ml-6 space-y-2">
              <Label>Lock After (Days)</Label>
              <Input
                type="number"
                value={currentData?.invoice_lock_after_days || 7}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData({ ...formData!, invoice_lock_after_days: Number(e.target.value) })
                }
                className="max-w-xs"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label>Prevent Financial Record Deletion</Label>
              <p className="text-sm text-muted-foreground">
                Invoices and payments cannot be deleted, only voided
              </p>
            </div>
            <Switch
              checked={currentData?.prevent_financial_record_deletion || false}
              disabled={!isEditing}
              onCheckedChange={(checked) =>
                setFormData({ ...formData!, prevent_financial_record_deletion: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label>Require Justification for Adjustments</Label>
              <p className="text-sm text-muted-foreground">
                Manual invoice adjustments require written justification
              </p>
            </div>
            <Switch
              checked={currentData?.require_justification_for_adjustments || false}
              disabled={!isEditing}
              onCheckedChange={(checked) =>
                setFormData({ ...formData!, require_justification_for_adjustments: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label>Enforce Sequential Invoice Numbering</Label>
              <p className="text-sm text-muted-foreground">
                Invoice numbers must be sequential without gaps
              </p>
            </div>
            <Switch
              checked={currentData?.enforce_sequential_invoice_numbering || false}
              disabled={!isEditing}
              onCheckedChange={(checked) =>
                setFormData({ ...formData!, enforce_sequential_invoice_numbering: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label>Alert on Large Refunds</Label>
              <p className="text-sm text-muted-foreground">
                Notify admins when refunds exceed threshold
              </p>
            </div>
            <Switch
              checked={currentData?.alert_on_large_refunds || false}
              disabled={!isEditing}
              onCheckedChange={(checked) =>
                setFormData({ ...formData!, alert_on_large_refunds: checked })
              }
            />
          </div>

          {currentData?.alert_on_large_refunds && (
            <div className="ml-6 space-y-2">
              <Label>Alert Threshold (CHF)</Label>
              <Input
                type="number"
                value={currentData?.large_refund_threshold || 500}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData({ ...formData!, large_refund_threshold: Number(e.target.value) })
                }
                className="max-w-xs"
              />
            </div>
          )}

          {isEditing && (
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleSave}>Save Controls</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Log</CardTitle>
          <CardDescription>
            All financial actions are logged for compliance and accountability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.slice(0, 20).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge>{log.action_type.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{log.entity_type}</TableCell>
                  <TableCell>{log.user_name}</TableCell>
                  <TableCell className="capitalize">{log.user_role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {auditLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
