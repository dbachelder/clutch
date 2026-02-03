import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CronJob } from "@/lib/types";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { Clock, Calendar, Target, Zap, FileText } from "lucide-react";

interface JobMetadataProps {
  job: CronJob;
}

export function JobMetadata({ job }: JobMetadataProps) {
  const formatSchedule = (schedule: CronJob['schedule']) => {
    switch (schedule.kind) {
      case 'cron':
        return `${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ''}`;
      case 'every':
        const intervalMs = schedule.everyMs || 0;
        const minutes = Math.floor(intervalMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `Every ${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `Every ${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) return `Every ${minutes} minute${minutes > 1 ? 's' : ''}`;
        return `Every ${intervalMs / 1000} second${intervalMs !== 1000 ? 's' : ''}`;
      case 'at':
        return schedule.atMs ? format(new Date(schedule.atMs), 'PPpp') : 'One-time';
      default:
        return 'Unknown schedule';
    }
  };

  const getPayloadDescription = (payload: CronJob['payload']) => {
    switch (payload.kind) {
      case 'systemEvent':
        return payload.text || 'System event';
      case 'agentTurn':
        return payload.message || 'Agent turn';
      case 'script':
        return payload.command || 'Script execution';
      default:
        return 'Unknown payload';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              {job.name || `Job ${job.id}`}
            </CardTitle>
            {job.description && (
              <CardDescription className="mt-2">
                {job.description}
              </CardDescription>
            )}
          </div>
          <Badge variant={job.enabled ? "success" : "secondary"}>
            {job.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Schedule:</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {formatSchedule(job.schedule)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Target:</span>
              <Badge variant="outline" className="text-xs">
                {job.sessionTarget}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Payload:</span>
              <Badge variant="outline" className="text-xs">
                {job.payload.kind}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Job ID:</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {job.jobId || job.id}
              </span>
            </div>

            {job.createdAt && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Created:</span>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(parseISO(job.createdAt), { addSuffix: true })}
                </span>
              </div>
            )}

            {job.updatedAt && job.updatedAt !== job.createdAt && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Updated:</span>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(parseISO(job.updatedAt), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />
        
        <div>
          <h4 className="font-medium text-sm mb-2">Payload Details</h4>
          <div className="bg-muted p-3 rounded text-sm font-mono">
            {getPayloadDescription(job.payload)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}