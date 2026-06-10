// Billing & Finance Settings Page - MDC Operations Centre

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CircleNotch } from '@phosphor-icons/react';
import { useBillingFinanceSettingsStore } from './store';
import { PaymentProvidersSection } from './components/PaymentProvidersSection';
import { InvoiceConfigSection } from './components/InvoiceConfigSection';
import { TaxesVATSection } from './components/TaxesVATSection';
import { FeesPenaltiesSection } from './components/FeesPenaltiesSection';
import { RefundsCreditsSection } from './components/RefundsCreditsSection';
import { MembershipBillingSection } from './components/MembershipBillingSection';
import { FinancialPermissionsSection } from './components/FinancialPermissionsSection';
import { AccountingExportsSection } from './components/AccountingExportsSection';
import { AuditControlsSection } from './components/AuditControlsSection';

export function BillingFinanceSettingsPage() {
  const { loadAll, isLoading, stats } = useBillingFinanceSettingsStore();
  const [activeTab, setActiveTab] = useState('payment-providers');

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl">Billing & Finance Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure payment providers, invoicing, taxes, fees, refunds, and financial governance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="flex items-center gap-4 mr-4 text-sm">
                <div>
                  <Badge variant="outline">{stats.total_providers_enabled} Providers</Badge>
                </div>
                <div>
                  <Badge variant="outline">{stats.total_tax_rules_active} Tax Rules</Badge>
                </div>
                <div>
                  <Badge variant="outline">{stats.total_fees_defined} Fees</Badge>
                </div>
                {stats.pending_refund_approvals > 0 && (
                  <div>
                    <Badge variant="destructive">{stats.pending_refund_approvals} Pending Approvals</Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-9 w-full">
              <TabsTrigger value="payment-providers">Payment Providers</TabsTrigger>
              <TabsTrigger value="invoice-config">Invoice Config</TabsTrigger>
              <TabsTrigger value="taxes-vat">Taxes & VAT</TabsTrigger>
              <TabsTrigger value="fees-penalties">Fees & Penalties</TabsTrigger>
              <TabsTrigger value="refunds-credits">Refunds & Credits</TabsTrigger>
              <TabsTrigger value="membership-billing">Membership Billing</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="accounting">Accounting</TabsTrigger>
              <TabsTrigger value="audit">Audit & Controls</TabsTrigger>
            </TabsList>

            <TabsContent value="payment-providers">
              <PaymentProvidersSection />
            </TabsContent>

            <TabsContent value="invoice-config">
              <InvoiceConfigSection />
            </TabsContent>

            <TabsContent value="taxes-vat">
              <TaxesVATSection />
            </TabsContent>

            <TabsContent value="fees-penalties">
              <FeesPenaltiesSection />
            </TabsContent>

            <TabsContent value="refunds-credits">
              <RefundsCreditsSection />
            </TabsContent>

            <TabsContent value="membership-billing">
              <MembershipBillingSection />
            </TabsContent>

            <TabsContent value="permissions">
              <FinancialPermissionsSection />
            </TabsContent>

            <TabsContent value="accounting">
              <AccountingExportsSection />
            </TabsContent>

            <TabsContent value="audit">
              <AuditControlsSection />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}