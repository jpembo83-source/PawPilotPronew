import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { FileText, DollarSign, CreditCard, Package, CircleAlert } from 'lucide-react';
import { usePricingStore } from '../../../pricing/store';
import { toast } from 'sonner';

const ACTION_ICONS = {
  CREATE_SERVICE: FileText,
  UPDATE_SERVICE: FileText,
  DELETE_SERVICE: FileText,
  CREATE_PRICE_BOOK: DollarSign,
  UPDATE_PRICE_BOOK: DollarSign,
  DELETE_PRICE_BOOK: DollarSign,
  CREATE_PRICE_ENTRY: DollarSign,
  UPDATE_PRICE_ENTRY: DollarSign,
  DELETE_PRICE_ENTRY: DollarSign,
  CREATE_PRICE_OVERRIDE: DollarSign,
  UPDATE_PRICE_OVERRIDE: DollarSign,
  DELETE_PRICE_OVERRIDE: DollarSign,
  CREATE_MEMBERSHIP: CreditCard,
  UPDATE_MEMBERSHIP: CreditCard,
  DELETE_MEMBERSHIP: CreditCard,
  CREATE_PACKAGE: Package,
  UPDATE_PACKAGE: Package,
  DELETE_PACKAGE: Package,
};

const ACTION_COLORS = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
} as const;

export function PricingAuditLog() {
  const { auditLog, fetchAuditLog } = usePricingStore();

  useEffect(() => {
    const loadAuditLog = async () => {
      try {
        await fetchAuditLog();
      } catch (e) {
        console.error('Failed to load audit log:', e);
        toast.error('Failed to load audit log');
      }
    };

    loadAuditLog();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Audit Log</CardTitle>
        <CardDescription>
          All pricing changes are logged here with timestamp, user, and details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLog.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No audit entries found
                </TableCell>
              </TableRow>
            ) : (
              auditLog.map((entry) => {
                const Icon = ACTION_ICONS[entry.action as keyof typeof ACTION_ICONS] || CircleAlert;
                const actionType = entry.action.split('_')[0] as keyof typeof ACTION_COLORS;
                const actionColor = ACTION_COLORS[actionType] || 'default';

                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={actionColor}>
                          {entry.action.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {entry.entity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="text-sm truncate" title={entry.details}>
                        {entry.details}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{entry.userId}</div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {auditLog.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {auditLog.length} audit entries
          </div>
        )}
      </CardContent>
    </Card>
  );
}