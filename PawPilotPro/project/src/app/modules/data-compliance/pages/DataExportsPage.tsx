// Data Exports - Data & Compliance

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus, DownloadSimple, Lock } from '@phosphor-icons/react';
import { useDataComplianceStore } from '../store';
import { CreateExportDialog } from '../components/CreateExportDialog';

export function DataExportsPage() {
  const { exports, markExportDownloaded } = useDataComplianceStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState<string | null>(null);

  const handleDownload = async (exp: any) => {
    if (exp.status === 'ready') {
      setShowPassword(exp.id);
      await markExportDownloaded(exp.id, 'current-user');
      setTimeout(() => setShowPassword(null), 5000);
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
                    {exp.status === 'ready' ? (
                      <Button size="sm" onClick={() => handleDownload(exp)}>
                        <DownloadSimple className="h-4 w-4 mr-2" />
                        DownloadSimple
                      </Button>
                    ) : exp.status === 'downloaded' ? (
                      <Badge variant="secondary">Downloaded</Badge>
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

          {showPassword && (
            <Card className="mt-4 border-green-600">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Export Password</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Use this password to decrypt the export file:
                    </p>
                    <code className="bg-green-50 text-green-700 px-3 py-2 rounded font-mono text-lg">
                      {exports.find((e) => e.id === showPassword)?.file_password}
                    </code>
                    <p className="text-xs text-muted-foreground mt-2">
                      This password will only be shown once. Store it securely.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <CreateExportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
