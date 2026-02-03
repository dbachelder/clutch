'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CronRun } from "@/lib/types";
import { RunStatusBadge } from "./run-status-badge";
import { useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { History, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

interface RunHistoryProps {
  runs: CronRun[];
  jobId: string;
}

export function RunHistory({ runs, jobId }: RunHistoryProps) {
  const [page, setPage] = useState(0);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const pageSize = 10;

  const paginatedRuns = runs.slice(page * pageSize, (page + 1) * pageSize);
  const hasMorePages = runs.length > (page + 1) * pageSize;
  const hasPreviousPages = page > 0;

  const toggleErrorExpanded = (runId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedErrors(newExpanded);
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 'Running...';
    
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const durationMs = end.getTime() - start.getTime();
    
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getSessionUrl = (sessionId?: string) => {
    if (!sessionId) return null;
    // TODO: Implement proper session URL routing when session pages are created
    return `/sessions/${sessionId}`;
  };

  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Execution History
          </CardTitle>
          <CardDescription>
            No execution history found for this job
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Execution History
        </CardTitle>
        <CardDescription>
          {runs.length} total run{runs.length !== 1 ? 's' : ''} • Most recent first
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRuns.map((run) => (
                <>
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {format(parseISO(run.startTime), 'MMM d, yyyy')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format(parseISO(run.startTime), 'h:mm:ss a')} • {' '}
                          {formatDistanceToNow(parseISO(run.startTime), { addSuffix: true })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {formatDuration(run.startTime, run.endTime)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge 
                        status={run.status} 
                        errorMessage={run.errorMessage}
                      />
                    </TableCell>
                    <TableCell>
                      {run.sessionId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 font-mono text-xs"
                          onClick={() => {
                            const url = getSessionUrl(run.sessionId);
                            if (url) {
                              // TODO: Navigate to session page when routing is implemented
                              console.log('Navigate to session:', url);
                            }
                          }}
                        >
                          {run.sessionId.slice(0, 8)}...
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {run.status === 'error' && run.errorMessage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleErrorExpanded(run.id)}
                          className="h-auto p-1"
                        >
                          {expandedErrors.has(run.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {run.status === 'error' && run.errorMessage && expandedErrors.has(run.id) && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30">
                        <div className="py-2">
                          <h5 className="font-medium text-sm mb-2 text-destructive">Error Details</h5>
                          <pre className="text-xs bg-background p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                            {run.errorMessage}
                          </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {(hasMorePages || hasPreviousPages) && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, runs.length)} of {runs.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={!hasPreviousPages}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!hasMorePages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}