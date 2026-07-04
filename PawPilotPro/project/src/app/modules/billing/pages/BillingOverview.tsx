// Billing Overview - MDC Operations Centre
// Dashboard for billing and financial overview

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { 
  TrendUp, TrendDown, Warning, Clock, 
  CreditCard, UsersThree, FileText, ArrowClockwise 
} from '@phosphor-icons/react';
import { useBillingStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { BackendStatus } from '../../../components/BackendStatus';
import { useCurrency } from '../../../utils/currency';
import { usePermissions } from '../../../hooks/usePermissions';
import { CreateInvoiceDialog } from '../components/CreateInvoiceDialog';

export function BillingOverview() {
  const { overview, loading, error, fetchOverview } = useBillingStore();
  const { selectedLocationId } = useSettingsStore();
  const { format: formatCurrency } = useCurrency();
  const { hasPermission } = usePermissions();
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const canCreateInvoice = hasPermission('invoices', 'create');

  useEffect(() => {
    fetchOverview(selectedLocationId);
  }, [selectedLocationId, fetchOverview]);

  const handleRefresh = () => {
    fetchOverview(selectedLocationId);
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <ArrowClockwise className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackendStatus />
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Unable to load billing data</p>
              <p className="text-sm">{error}</p>
              <p className="text-sm mt-2">
                💡 <strong>Quick fix:</strong> Click the <strong>Deploy/Publish</strong> button in Figma Make to deploy the backend. 
                The billing API routes need to be deployed before they can be accessed.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="space-y-4">
        <BackendStatus />
        <Alert>
          <AlertDescription>
            No billing data available. Click "Seed Data" in the Invoices tab to generate sample data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backend Status Indicator */}
      <BackendStatus />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Billing Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Financial summary and key metrics
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <ArrowClockwise className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Outstanding Balance */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-semibold text-slate-900">
                  {formatCurrency(overview.outstanding.total)}
                </p>
                <p className="text-sm text-slate-500">Total outstanding</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Current (0-7 days)</span>
                  <span className="font-medium">{formatCurrency(overview.outstanding.current)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">8-30 days</span>
                  <span className="font-medium text-orange-600">{formatCurrency(overview.outstanding.early)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">31-60 days</span>
                  <span className="font-medium text-orange-700">{formatCurrency(overview.outstanding.mid)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">60+ days</span>
                  <span className="font-medium text-red-600">{formatCurrency(overview.outstanding.late)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              <Clock className="h-4 w-4 inline mr-1" />
              Due This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {overview.invoices_due_this_week}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {formatCurrency(overview.invoices_due_total)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              <Warning className="h-4 w-4 inline mr-1" />
              Failed Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {overview.failed_payments}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {overview.failed_payments === 0 ? 'All clear' : 'Requires attention'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              <UsersThree className="h-4 w-4 inline mr-1" />
              Active Memberships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {overview.active_memberships}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {formatCurrency(overview.membership_revenue)}/mo
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Received */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              Payments Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-green-600">
                {formatCurrency(overview.payments.today)}
              </p>
              <TrendUp className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              Payments This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-green-600">
                {formatCurrency(overview.payments.week)}
              </p>
              <TrendUp className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              Payments This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-green-600">
                {formatCurrency(overview.payments.month)}
              </p>
              <TrendUp className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credits & Refunds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              <CreditCard className="h-4 w-4 inline mr-1" />
              Credits Issued (Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrency(overview.credits_month)}
              </p>
              <TrendDown className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              <FileText className="h-4 w-4 inline mr-1" />
              Refunds Issued (Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrency(overview.refunds_month)}
              </p>
              <TrendDown className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateInvoice(true)}
              disabled={!canCreateInvoice}
              title={canCreateInvoice ? undefined : "You don't have permission to create invoices"}
            >
              Create Invoice
            </Button>
            <Button variant="outline" size="sm">
              Record Payment
            </Button>
            <Button variant="outline" size="sm">
              Apply Credit
            </Button>
            <Button variant="outline" size="sm">
              Issue Refund
            </Button>
            <Button variant="outline" size="sm">
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <CreateInvoiceDialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice} />
    </div>
  );
}