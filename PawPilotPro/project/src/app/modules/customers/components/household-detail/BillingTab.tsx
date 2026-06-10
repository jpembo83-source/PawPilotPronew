import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Receipt, Warning } from '@phosphor-icons/react';
import { useAuth } from '../../../../context/AuthContext';

interface BillingTabProps {
  householdId: string;
}

export function BillingTab({ householdId }: BillingTabProps) {
  const { user } = useAuth();
  
  // Check for financial_data permission (when implemented)
  const hasFinancialAccess = user?.role === 'admin' || user?.role === 'manager';
  
  if (!hasFinancialAccess) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-12 text-center">
          <Warning className="h-12 w-12 text-amber-600 mx-auto mb-4" />
          <h3 className="font-semibold text-amber-900 mb-2">Access Restricted</h3>
          <p className="text-amber-700">
            You don't have permission to view financial data
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Invoicing</CardTitle>
        <CardDescription>
          View invoices, payments, credits, and outstanding balance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-slate-400">
          <Receipt className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p>Billing history will appear here</p>
          <p className="text-sm mt-1">Integration with Billing module</p>
        </div>
      </CardContent>
    </Card>
  );
}
