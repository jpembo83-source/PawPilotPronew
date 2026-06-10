// Access Logs - Data & Compliance

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Eye } from '@phosphor-icons/react';
import { useDataComplianceStore } from '../store';

export function AccessLogsPage() {
  const { accessLogs } = useDataComplianceStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sensitive Data Access Logs</CardTitle>
        <CardDescription>
          Monitor access to personal, medical, behavioural, and financial data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Data Category</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Module</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accessLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">{new Date(log.accessed_at).toLocaleString()}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{log.user_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{log.user_role}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{log.access_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className="capitalize">{log.data_category}</Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{log.entity_description}</p>
                    <p className="text-xs text-muted-foreground capitalize">{log.entity_type}</p>
                  </div>
                </TableCell>
                <TableCell>{log.module}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {accessLogs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No access logs recorded yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
