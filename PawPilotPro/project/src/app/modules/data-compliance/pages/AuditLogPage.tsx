// Audit Log - Data & Compliance

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { FileText } from '@phosphor-icons/react';
import { useDataComplianceStore } from '../store';

export function AuditLogPage() {
  const { auditLogs } = useDataComplianceStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Audit Log</CardTitle>
        <CardDescription>
          Complete, immutable audit trail of all compliance-related actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action Type</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className="capitalize">{log.action_type.replace(/_/g, ' ')}</Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm capitalize">{log.entity_type}</p>
                    <p className="text-xs text-muted-foreground font-mono">{log.entity_id.slice(0, 8)}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{log.user_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{log.user_role}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{log.action_description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {auditLogs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No audit logs available.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
