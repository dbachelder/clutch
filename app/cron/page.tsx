'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CronJob } from '@/lib/types';
import { openclawAPI } from '@/lib/openclaw-api';
import { Clock, ExternalLink, Loader2, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function CronListPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      await openclawAPI.connect();
      const cronJobs = await openclawAPI.getCronJobs();
      setJobs(cronJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  };

  const formatSchedule = (schedule: CronJob['schedule']) => {
    switch (schedule.kind) {
      case 'cron':
        return schedule.expr || 'Cron expression';
      case 'every':
        const intervalMs = schedule.everyMs || 0;
        const minutes = Math.floor(intervalMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `Every ${days}d`;
        if (hours > 0) return `Every ${hours}h`;
        if (minutes > 0) return `Every ${minutes}m`;
        return `Every ${intervalMs / 1000}s`;
      case 'at':
        return 'One-time';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading cron jobs...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Connection Error</CardTitle>
            <CardDescription>
              Failed to connect to OpenClaw gateway
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadJobs}>
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Cron Jobs
            </h1>
            <p className="text-muted-foreground">
              Manage scheduled tasks and automation
            </p>
          </div>
          <Button disabled>
            <Plus className="w-4 h-4 mr-2" />
            New Job (Coming Soon)
          </Button>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Cron Jobs Found</CardTitle>
              <CardDescription>
                No scheduled jobs are currently configured
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cron jobs will appear here once they are created through OpenClaw.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {jobs.length} Job{jobs.length !== 1 ? 's' : ''}
              </CardTitle>
              <CardDescription>
                Click on a job to view its execution history and details
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {job.name || `Job ${job.id}`}
                            </span>
                            {job.description && (
                              <span className="text-sm text-muted-foreground">
                                {job.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {formatSchedule(job.schedule)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {job.sessionTarget}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={job.enabled ? "success" : "secondary"}>
                            {job.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {job.createdAt ? (
                            <span className="text-sm text-muted-foreground">
                              {format(parseISO(job.createdAt), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/cron/${job.jobId || job.id}`}>
                            <Button variant="ghost" size="sm" className="h-auto p-1">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}