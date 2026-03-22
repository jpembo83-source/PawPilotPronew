// Financial Permissions Section

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { useBillingFinanceSettingsStore } from '../store';
import type { FinancialPermission } from '../types';

export function FinancialPermissionsSection() {
  const { permissions, approvalRules, updatePermission } = useBillingFinanceSettingsStore();

  const handleTogglePermission = async (
    permission: FinancialPermission,
    field: keyof FinancialPermission,
    value: boolean
  ) => {
    await updatePermission(permission.id, {
      [field]: value,
      updated_by: 'current-user',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Financial Permissions by Role</CardTitle>
          <CardDescription>
            Control which roles can perform financial actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>View Financial Data</TableHead>
                <TableHead>Issue Refunds</TableHead>
                <TableHead>Apply Credits</TableHead>
                <TableHead>Waive Fees</TableHead>
                <TableHead>Export Reports</TableHead>
                <TableHead>Modify Invoices</TableHead>
                <TableHead>Bypass Approvals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell className="font-medium capitalize">{perm.role.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <Switch
                      checked={perm.can_view_financial_data}
                      onCheckedChange={(checked) =>
                        handleTogglePermission(perm, 'can_view_financial_data', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={perm.can_issue_refunds}
                      onCheckedChange={(checked) =>
                        handleTogglePermission(perm, 'can_issue_refunds', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={perm.can_apply_credits}
                      onCheckedChange={(checked) =>
                        handleTogglePermission(perm, 'can_apply_credits', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={perm.can_waive_fees}
                      onCheckedChange={(checked) =>
                        handleTogglePermission(perm, 'can_waive_fees', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={perm.can_export_reports}
                      onCheckedChange={(checked) =>
                        handleTogglePermission(perm, 'can_export_reports', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={perm.can_modify_invoices}
                      onCheckedChange={(checked) =>
                        handleTogglePermission(perm, 'can_modify_invoices', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={perm.bypass_approvals}
                      onCheckedChange={(checked) =>
                        handleTogglePermission(perm, 'bypass_approvals', checked)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval Rules</CardTitle>
          <CardDescription>Actions requiring approval based on thresholds</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action Type</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Approver Roles</TableHead>
                <TableHead>Notifications</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvalRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium capitalize">
                    {rule.action_type.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    {rule.threshold_amount} {rule.currency}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {rule.approver_roles.map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.notification_enabled ? 'default' : 'secondary'}>
                      {rule.notification_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? 'success' : 'secondary'}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
