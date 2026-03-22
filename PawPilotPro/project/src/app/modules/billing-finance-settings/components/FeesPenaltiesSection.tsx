// Fees & Penalties Section - Billing & Finance Settings

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus } from 'lucide-react';
import { useBillingFinanceSettingsStore } from '../store';
import { FeeDialog } from './modals/FeeDialog';
import type { FeeDefinition } from '../types';

export function FeesPenaltiesSection() {
  const { fees, deleteFee } = useBillingFinanceSettingsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeDefinition | null>(null);

  const handleEdit = (fee: FeeDefinition) => {
    setEditingFee(fee);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingFee(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this fee definition?')) {
      await deleteFee(id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fees & Penalties</CardTitle>
              <CardDescription>
                Define operational fees that can be applied to bookings and invoices
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Fee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Calculation</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Grace Period</TableHead>
                <TableHead>Waiver Approval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>
                    <Badge>{fee.fee_type.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{fee.name}</TableCell>
                  <TableCell>{fee.calculation_method.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    {fee.calculation_method === 'percentage' ? `${fee.amount}%` : `CHF ${fee.amount}`}
                    {fee.block_size_minutes && ` / ${fee.block_size_minutes} min`}
                  </TableCell>
                  <TableCell>
                    {fee.grace_period_minutes ? `${fee.grace_period_minutes} min` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={fee.requires_approval_to_waive ? 'default' : 'secondary'}>
                      {fee.requires_approval_to_waive ? 'Required' : 'Not Required'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={fee.is_active ? 'success' : 'secondary'}>
                      {fee.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(fee)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(fee.id)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {fees.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No fees configured.
            </div>
          )}
        </CardContent>
      </Card>

      <FeeDialog open={dialogOpen} onOpenChange={setDialogOpen} fee={editingFee} />
    </>
  );
}
