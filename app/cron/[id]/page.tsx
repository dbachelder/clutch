'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CronJob, CronRun } from '@/lib/types';
import { openclawAPI } from '@/lib/openclaw-api';
import { JobMetadata } from '@/components/cron/job-metadata';
import { JobControls } from '@/components/cron/job-controls';
import { RunHistory } from '@/components/cron/run-history';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';

export default function CronDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  
  const [job, setJob] = useState<CronJob | null>(null);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = async () => {
    try {
      setLoading(true);
      setError(null);
      await openclawAPI.connect();
      
      // Load job details and execution history in parallel
      const [jobData, runsData] = await Promise.all([
        openclawAPI.getCronJob(jobId),
        openclawAPI.getCronRuns(jobId)
      ]);
      
      setJob(jobData);
      setRuns(runsData.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [jobData, runsData] = await Promise.all([
        openclawAPI.getCronJob(jobId),
        openclawAPI.getCronRuns(jobId)
      ]);
      
      setJob(jobData);
      setRuns(runsData.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh job data');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading job details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/cron">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Cron Jobs
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              {error ? 'Error Loading Job' : 'Job Not Found'}
            </CardTitle>
            <CardDescription>
              {error || `Cron job with ID "${jobId}" could not be found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={loadJobData}>
                Retry
              </Button>
              <Link href="/cron">
                <Button variant="outline">
                  Back to Cron Jobs
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/cron">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Cron Jobs
              </Button>
            </Link>
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight">
                {job.name || `Cron Job ${jobId}`}
              </h1>
              <p className="text-muted-foreground">
                Job ID: {jobId}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Job Metadata */}
        <JobMetadata job={job} />

        {/* Job Controls */}
        <JobControls job={job} onJobUpdated={handleRefresh} />

        {/* Execution History */}
        <RunHistory runs={runs} jobId={jobId} />
      </div>
    </div>
  );
}