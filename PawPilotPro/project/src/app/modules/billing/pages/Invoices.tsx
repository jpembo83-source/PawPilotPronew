// Invoices Page - MDC Operations Centre
// Invoice list and detail management with RBAC enforcement

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Input } from '../../../components/ui/input';
import { 
  FileText, Search, Filter, Plus, Send, Eye, Ban, 
  CheckCircle, Clock, AlertCircle, XCircle, Lock
} from 'lucide-react';
import { useBillingStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { useCurrency } from '../../../utils/currency';
import { usePermissions } from '../../../hooks/usePermissions';
import { PermissionGate } from '../../../components/PermissionGate';
import type { Invoice, InvoiceStatus } from '../store';

export function Invoices() {
  const { invoices, loading, error, fetchInvoices, seedData } = useBillingStore();
  const { selectedLocationId } = useSettingsStore();
  const { format: formatCurrency } = useCurrency();
  const { hasPermission, isAdmin } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');

  // Check permissions for actions
  const canCreate = hasPermission('invoices', 'create');
  const canEdit = hasPermission('invoices', 'update');
  const canDelete = hasPermission('invoices', 'delete');
  const canExport = hasPermission('invoices', 'export');

  useEffect(() => {
    const filters: Record<string, any> = {};
    if (selectedLocationId && selectedLocationId !== 'all') {
      filters.location_id = selectedLocationId;
    }
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    
    fetchInvoices(filters);
  }, [selectedLocationId, statusFilter, fetchInvoices]);

  const getStatusBadge = (status: InvoiceStatus) => {
    const config = {
      draft: { variant: 'secondary' as const, icon: FileText, label: 'Draft' },
      issued: { variant: 'default' as const, icon: Clock, label: 'Issued' },
      paid: { variant: 'default' as const, icon: CheckCircle, label: 'Paid', className: 'bg-green-600' },
      overdue: { variant: 'destructive' as const, icon: AlertCircle, label: 'Overdue' },
      void: { variant: 'secondary' as const, icon: XCircle, label: 'Void' },
      part_paid: { variant: 'default' as const, icon: Clock, label: 'Part Paid', className: 'bg-blue-600' },
    };

    const { variant, icon: Icon, label, className } = config[status];
    return (
      <Badge variant={variant} className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const filteredInvoices = invoices.filter(invoice => 
    searchTerm === '' || 
    invoice.household_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage invoices and billing documents
          </p>
        </div>
        <div className="flex gap-2">
          {/* Seed data - admin only */}
          {isAdmin && (
            <Button onClick={seedData} variant="outline" size="sm">
              Seed Data
            </Button>
          )}
          
          {/* Create button - requires create permission */}
          {canCreate ? (
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          ) : (
            <Button size="sm" disabled variant="outline" title="You don't have permission to create invoices">
              <Lock className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="part_paid">Part Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            All Invoices ({filteredInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-slate-900 rounded-full" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="font-medium">No invoices found</p>
              <p className="text-sm mt-1">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Create your first invoice to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Household</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>{invoice.household_name}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {invoice.location_name}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.issue_date 
                          ? new Date(invoice.issue_date).toLocaleDateString('en-GB')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.due_date 
                          ? new Date(invoice.due_date).toLocaleDateString('en-GB')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoice.balance > 0 ? (
                          <span className="text-orange-600">
                            {formatCurrency(invoice.balance)}
                          </span>
                        ) : (
                          <span className="text-green-600">{formatCurrency(0)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'issued' && (
                            <Button variant="ghost" size="sm">
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}