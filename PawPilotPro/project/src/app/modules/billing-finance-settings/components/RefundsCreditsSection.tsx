// Refunds & Credits Section

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { useBillingFinanceSettingsStore } from '../store';

export function RefundsCreditsSection() {
  const { refundSettings, updateRefundSettings } = useBillingFinanceSettingsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(refundSettings);

  const handleSave = async () => {
    if (formData) {
      await updateRefundSettings({ ...formData, updated_by: 'current-user' });
      setIsEditing(false);
    }
  };

  if (!refundSettings) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No refund settings found. Use "Seed Data" to create defaults.
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentData = isEditing ? formData : refundSettings;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Refunds & Credits Settings</CardTitle>
            <CardDescription>Control how refunds and account credits are handled</CardDescription>
          </div>
          {!isEditing && (
            <Button onClick={() => { setFormData(refundSettings); setIsEditing(true); }}>
              Edit Settings
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-medium">Approval Thresholds</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Approval Required Above (CHF)</Label>
              <Input
                type="number"
                value={currentData?.approval_threshold_chf || 0}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData({ ...formData!, approval_threshold_chf: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium">Maximum Refund Amounts by Role</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Admin</Label>
              <Input
                type="number"
                value={currentData?.max_refund_amount_by_role.admin || 0}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData({
                    ...formData!,
                    max_refund_amount_by_role: {
                      ...formData!.max_refund_amount_by_role,
                      admin: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Manager</Label>
              <Input
                type="number"
                value={currentData?.max_refund_amount_by_role.manager || 0}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData({
                    ...formData!,
                    max_refund_amount_by_role: {
                      ...formData!.max_refund_amount_by_role,
                      manager: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Assistant Manager</Label>
              <Input
                type="number"
                value={currentData?.max_refund_amount_by_role.assistant_manager || 0}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData({
                    ...formData!,
                    max_refund_amount_by_role: {
                      ...formData!.max_refund_amount_by_role,
                      assistant_manager: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium">Credit Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Credit Expiry (Days)</Label>
              <Input
                type="number"
                value={currentData?.credit_expiry_days || 0}
                disabled={!isEditing}
                placeholder="Leave empty for no expiry"
                onChange={(e) =>
                  setFormData({ ...formData!, credit_expiry_days: Number(e.target.value) || null })
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Credits Transferable</Label>
                <Switch
                  checked={currentData?.credits_transferable || false}
                  disabled={!isEditing}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData!, credits_transferable: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleSave}>Save Changes</Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
