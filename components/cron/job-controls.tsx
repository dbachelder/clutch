'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CronJob } from "@/lib/types";
import { openclawAPI } from "@/lib/openclaw-api";
import { useState } from "react";
import { Play, Power, PowerOff, Loader2 } from "lucide-react";

interface JobControlsProps {
  job: CronJob;
  onJobUpdated?: () => void;
}

export function JobControls({ job, onJobUpdated }: JobControlsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleRunNow = async () => {
    setIsRunning(true);
    try {
      await openclawAPI.runCronJob(job.jobId || job.id);
      onJobUpdated?.();
    } catch (error) {
      console.error('Failed to run cron job:', error);
      // TODO: Add toast notification for error
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleEnabled = async () => {
    setIsToggling(true);
    try {
      if (job.enabled) {
        await openclawAPI.disableCronJob(job.jobId || job.id);
      } else {
        await openclawAPI.enableCronJob(job.jobId || job.id);
      }
      onJobUpdated?.();
    } catch (error) {
      console.error('Failed to toggle cron job:', error);
      // TODO: Add toast notification for error
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="w-5 h-5" />
          Job Controls
        </CardTitle>
        <CardDescription>
          Manually run the job or enable/disable automatic execution
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleRunNow}
            disabled={isRunning || isToggling}
            className="flex-1"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isRunning ? 'Running...' : 'Run Now'}
          </Button>
          
          <Button
            onClick={handleToggleEnabled}
            disabled={isRunning || isToggling}
            variant={job.enabled ? "destructive" : "outline"}
            className="flex-1"
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : job.enabled ? (
              <PowerOff className="w-4 h-4 mr-2" />
            ) : (
              <Power className="w-4 h-4 mr-2" />
            )}
            {isToggling ? 'Updating...' : (job.enabled ? 'Disable Job' : 'Enable Job')}
          </Button>
        </div>
        
        <div className="mt-3 text-sm text-muted-foreground">
          {job.enabled ? (
            <p>Job is currently enabled and will run according to its schedule.</p>
          ) : (
            <p>Job is disabled and will not run automatically. You can still run it manually.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}