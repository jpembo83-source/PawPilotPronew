// Retention & Deletion Jobs - Data & Compliance

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Play, Clock } from 'lucide-react';
import { useDataComplianceStore } from '../store';
import { toast } from 'sonner';

export function RetentionJobsPage() {
  const { retentionJobs, executeRetentionJob } = useDataComplianceStore();

  const handleExecute = async (jobId: string) => {
    if (confirm('Execute this retention job now? This action cannot be undone.')) {
      await executeRetentionJob(jobId);
      toast.success('Retention job started');
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExecute(job.id)}
                    disabled={!job.is_active}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Now
                  </Button>
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
      </CardContent>
    </Card>
  );
}
