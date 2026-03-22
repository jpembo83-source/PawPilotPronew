// Data Subject Requests (GDPR Workflows) - Data & Compliance

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus } from 'lucide-react';
import { useDataComplianceStore } from '../store';
import { CreateRequestDialog } from '../components/CreateRequestDialog';
import { RequestDetailsDialog } from '../components/RequestDetailsDialog';
import type { DataSubjectRequest } from '../types';

export function DataSubjectRequestsPage() {
  const { requests } = useDataComplianceStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DataSubjectRequest | null>(null);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Subject Requests</CardTitle>
              <CardDescription>
                Handle GDPR requests: access, rectification, erasure, and restriction
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Household</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-mono text-xs">{request.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge className="capitalize">{request.request_type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{request.household_name}</TableCell>
                  <TableCell className="capitalize">{request.request_source}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(request.status)} className="capitalize">
                      {request.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(request.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelectedRequest(request)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {requests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No data subject requests found. Click "New Request" to create one.
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRequestDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <RequestDetailsDialog request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </>
  );
}
