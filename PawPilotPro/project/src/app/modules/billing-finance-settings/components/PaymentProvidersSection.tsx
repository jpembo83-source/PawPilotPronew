// Payment Providers Section - Billing & Finance Settings

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { useBillingFinanceSettingsStore } from '../store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import type { PaymentProvider } from '../types';

export function PaymentProvidersSection() {
  const { paymentProviders, updatePaymentProvider } = useBillingFinanceSettingsStore();

  const handleToggleEnabled = async (provider: PaymentProvider) => {
    await updatePaymentProvider(provider.id, {
      enabled: !provider.enabled,
      updated_by: 'current-user',
    });
  };

  const handleToggleEnvironment = async (provider: PaymentProvider) => {
    await updatePaymentProvider(provider.id, {
      environment: provider.environment === 'live' ? 'test' : 'live',
      updated_by: 'current-user',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Providers</CardTitle>
          <CardDescription>
            Configure which payment providers are available throughout the platform. Disabled providers cannot be used for any transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Supported Currencies</TableHead>
                <TableHead>Payment Methods</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentProviders.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">
                    {provider.provider_name === 'stripe' && 'Stripe'}
                    {provider.provider_name === 'bank_transfer' && 'Bank Transfer'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={provider.environment === 'live' ? 'default' : 'secondary'}>
                      {provider.environment}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {provider.supported_currencies.map((currency) => (
                        <Badge key={currency} variant="outline" className="text-xs">
                          {currency}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap max-w-xs">
                      {provider.supported_payment_methods.map((method) => (
                        <Badge key={method} variant="outline" className="text-xs">
                          {method.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={provider.enabled ? 'success' : 'secondary'}>
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={provider.enabled}
                          onCheckedChange={() => handleToggleEnabled(provider)}
                        />
                        <Label className="text-xs">Enable</Label>
                      </div>
                      {provider.provider_name === 'stripe' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleEnvironment(provider)}
                        >
                          Switch to {provider.environment === 'live' ? 'Test' : 'Live'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {paymentProviders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No payment providers configured. Add a payment provider to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>Stripe:</strong> Primary provider for card payments, Apple Pay, Google Pay, and SEPA Direct Debit. Requires API keys to be configured in environment.
          </div>
          <div>
            <strong>Bank Transfer:</strong> Manual payment method. Transactions must be reconciled manually by finance team.
          </div>
          <div className="pt-2 border-t">
            <strong>Important:</strong> Disabling a provider will prevent all new transactions using that provider. Existing transactions and recurring payments will not be affected.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}