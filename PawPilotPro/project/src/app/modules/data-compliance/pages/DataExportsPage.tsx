// Data Exports - Data & Compliance

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus, DownloadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useDataComplianceStore } from '../store';
import { getExportDownloadUrl } from '../api';
import type { DataExport } from '../types';
import { CreateExportDialog } from '../components/CreateExportDialog';

export function DataExportsPage() {
  const { exports, markExportDownloaded } = useDataComplianceStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDownload = async (exp: DataExport) => {
    try {
      // Files live in a private bucket; the server mints a short-lived
      // signed URL (and audit-logs the access) on each download.
      const { url } = await getExportDownloadUrl(exp.id);
      window.open(url, '_blank', 'noopener');
      await markExportDownloaded(exp.id, 'current-user');
    } catch {
      toast.error('Could not get a download link for this export');
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ready': return 'success';
      case 'generating': return 'secondary';
      case 'expired': return 'destructive';
      case 'downloaded': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Exports</CardTitle>
              <CardDescription>
                Export customer, operational, and compliance data securely
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Export Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exports.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium capitalize">{exp.export_type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{exp.scope}</Badge>
                  </TableCell>
                  <TableCell className="uppercase">{exp.format}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(exp.status)} className="capitalize">
                      {exp.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(exp.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">
                    {exp.expires_at ? new Date(exp.expires_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    {exp.status === 'ready' || exp.status === 'downloaded' ? (
                      <Button size="sm" onClick={() => handleDownload(exp)}>
                        <DownloadSimple className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    ) : (
                      <Badge variant="secondary">Not Ready</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {exports.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No data exports found. Click "New Export" to create one.
            </div>
          )}

        </CardContent>
      </Card>

      <CreateExportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
