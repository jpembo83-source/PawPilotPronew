// Retention & Deletion Jobs - Data & Compliance

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Play, Clock, Binoculars } from '@phosphor-icons/react';
import { useDataComplianceStore } from '../store';
import { toast } from 'sonner';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

export function RetentionJobsPage() {
  const { retentionJobs, executeRetentionJob } = useDataComplianceStore();
  const { confirm, confirmDialog } = useConfirmDialog();

  const describeRun = (execution: {
    would_affect?: number;
    records_affected: number;
    skipped?: Array<{ reason: string }>;
    dry_run?: boolean;
  }) => {
    const skippedCount = execution.skipped?.length ?? 0;
    const skippedNote = skippedCount > 0 ? `, ${skippedCount} skipped (see execution log)` : '';
    return execution.dry_run
      ? `Dry run: ${execution.would_affect ?? 0} record(s) would be purged${skippedNote}. Nothing was deleted.`
      : `Purge complete: ${execution.records_affected} record(s) affected${skippedNote}.`;
  };

  const handleDryRun = async (jobId: string) => {
    const execution = await executeRetentionJob(jobId, { dryRun: true });
    if (execution) toast.info(describeRun(execution));
    else toast.error('Dry run failed');
  };

  const handleExecute = async (jobId: string) => {
    if (
      await confirm({
        title: 'Run this purge for real?',
        description:
          'Records past the retention window will be permanently deleted or anonymised. ' +
          'This cannot be undone — run a dry run first to see what will be affected.',
        confirmLabel: 'Purge now',
        destructive: true,
      })
    ) {
      const execution = await executeRetentionJob(jobId, { dryRun: false, confirm: true });
      if (execution) toast.success(describeRun(execution));
      else toast.error('Retention job failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention & Deletion Jobs</CardTitle>
        <CardDescription>
          Automated data retention, anonymisation, and deletion jobs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Retention Period</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {retentionJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.job_name}</TableCell>
                <TableCell className="capitalize">{job.job_type}</TableCell>
                <TableCell>{job.retention_period_days} days</TableCell>
                <TableCell className="text-sm">
                  {new Date(job.next_run_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">
                  {job.last_run_at ? (
                    <div>
                      {new Date(job.last_run_at).toLocaleDateString()}
                      {job.last_run_records_affected && (
                        <p className="text-xs text-muted-foreground">
                          {job.last_run_records_affected} records
                        </p>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      job.last_run_status === 'completed' ? 'success' :
                      job.last_run_status === 'failed' ? 'destructive' :
                      job.is_active ? 'default' : 'secondary'
                    }
                  >
                    {job.last_run_status || 'scheduled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDryRun(job.id)}
                      disabled={!job.is_active}
                    >
                      <Binoculars className="h-4 w-4 mr-2" />
                      Dry Run
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleExecute(job.id)}
                      disabled={!job.is_active}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Purge Now
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {retentionJobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No retention jobs configured.</p>
          </div>
        )}
        {confirmDialog}
      </CardContent>
    </Card>
  );
}
