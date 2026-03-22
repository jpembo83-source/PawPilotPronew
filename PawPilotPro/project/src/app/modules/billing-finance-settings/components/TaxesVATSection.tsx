// Taxes & VAT Section - Billing & Finance Settings

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus } from 'lucide-react';
import { useBillingFinanceSettingsStore } from '../store';
import { TaxRuleDialog } from './modals/TaxRuleDialog';
import type { TaxRule } from '../types';

export function TaxesVATSection() {
  const { taxRules, deleteTaxRule } = useBillingFinanceSettingsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null);

  const handleEdit = (rule: TaxRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this tax rule? This action cannot be undone.')) {
      await deleteTaxRule(id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tax & VAT Rules</CardTitle>
              <CardDescription>
                Configure tax rates for different service categories and locations
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tax Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Service Categories</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Effective Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.tax_type}</TableCell>
                  <TableCell>{rule.rate}%</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {rule.service_categories.map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {rule.location_id ? (
                      <Badge variant="secondary">Specific Location</Badge>
                    ) : (
                      <Badge>All Locations</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(rule.effective_from).toLocaleDateString()}
                    {rule.effective_until && ` - ${new Date(rule.effective_until).toLocaleDateString()}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? 'success' : 'secondary'}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(rule)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(rule.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {taxRules.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No tax rules configured. Click "Add Tax Rule" or use "Seed Data" to create defaults.
            </div>
          )}
        </CardContent>
      </Card>

      <TaxRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
      />
    </>
  );
}
