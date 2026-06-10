// Incidents & Breaches - Data & Compliance

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus, Warning } from '@phosphor-icons/react';
import { useDataComplianceStore } from '../store';
import { CreateBreachDialog } from '../components/CreateBreachDialog';
import type { BreachRecord } from '../types';

export function IncidentsBreachesPage() {
  const { breaches } = useDataComplianceStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBreach, setSelectedBreach] = useState<BreachRecord | null>(null);

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Incidents & Breaches</CardTitle>
              <CardDescription>
                Track and manage data-related incidents and security breaches
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Report Breach
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Affected Count</TableHead>
                <TableHead>Discovery Date</TableHead>
                <TableHead>Notified</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breaches.map((breach) => (
                <TableRow key={breach.id}>
                  <TableCell className="font-medium">{breach.title}</TableCell>
                  <TableCell>
                    <Badge variant={getSeverityVariant(breach.severity)} className="capitalize">
                      {breach.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{breach.estimated_affected_count || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(breach.discovery_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={breach.notification_required ? 'default' : 'secondary'}>
                        {breach.notification_required ? 'Required' : 'Not Required'}
                      </Badge>
                      {breach.regulator_notified && (
                        <p className="text-xs text-muted-foreground">Regulator notified</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        breach.status === 'closed' ? 'success' :
                        breach.status === 'open' ? 'destructive' : 'default'
                      }
                      className="capitalize"
                    >
                      {breach.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelectedBreach(breach)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {breaches.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Warning className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No data breaches reported.</p>
              <p className="text-sm mt-1">This is good news!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateBreachDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
