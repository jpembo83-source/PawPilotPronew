// Membership Billing Section

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { useBillingFinanceSettingsStore } from '../store';

export function MembershipBillingSection() {
  const { membershipBillingRules, updateMembershipBillingRules } = useBillingFinanceSettingsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(membershipBillingRules);

  const handleSave = async () => {
    if (formData) {
      await updateMembershipBillingRules({ ...formData, updated_by: 'current-user' });
      setIsEditing(false);
    }
  };

  if (!membershipBillingRules) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No membership billing rules found. Use "Seed Data" to create defaults.
        </CardContent>
      </Card>
    );
  }

  const currentData = isEditing ? formData : membershipBillingRules;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Membership Billing Rules</CardTitle>
            <CardDescription>Control how recurring membership payments are processed</CardDescription>
          </div>
          {!isEditing && (
            <Button onClick={() => { setFormData(membershipBillingRules); setIsEditing(true); }}>
              Edit Settings
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Billing Cycle</Label>
            <Select
              value={currentData?.billing_cycle || 'monthly_fixed'}
              disabled={!isEditing}
              onValueChange={(value: 'monthly_fixed' | 'rolling') =>
                setFormData({ ...formData!, billing_cycle: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly_fixed">Monthly Fixed Date</SelectItem>
                <SelectItem value="rolling">Rolling from Signup</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {currentData?.billing_cycle === 'monthly_fixed' && (
            <div className="space-y-2">
              <Label>Billing Day</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={currentData?.billing_day || 1}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData({ ...formData!, billing_day: Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-2 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label>Enable Proration</Label>
            <Switch
              checked={currentData?.proration_enabled || false}
              disabled={!isEditing}
              onCheckedChange={(checked) =>
                setFormData({ ...formData!, proration_enabled: checked })
              }
            />
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label>Enable Multi-Dog Discounts</Label>
            <Switch
              checked={currentData?.multi_dog_discount_enabled || false}
              disabled={!isEditing}
              onCheckedChange={(checked) =>
                setFormData({ ...formData!, multi_dog_discount_enabled: checked })
              }
            />
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
