export interface CronJob {
  id: string;
  jobId?: string;
  name?: string;
  schedule: {
    kind: 'cron' | 'every' | 'at';
    expr?: string;
    everyMs?: number;
    atMs?: number;
    tz?: string;
  };
  payload: {
    kind: 'systemEvent' | 'agentTurn' | 'script';
    text?: string;
    message?: string;
    command?: string;
  };
  sessionTarget: 'main' | 'isolated';
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
}

export interface CronRun {
  id: string;
  jobId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'running' | 'success' | 'error';
  errorMessage?: string;
  sessionId?: string;
  result?: any;
}

export interface CronJobStats {
  totalRuns: number;
  successCount: number;
  errorCount: number;
  avgDuration?: number;
  lastRun?: string;
  nextRun?: string;
}

export type CronStatus = 'running' | 'success' | 'error' | 'pending';

export interface OpenClawRPCRequest {
  id: string;
  method: string;
  params: Record<string, any>;
}

export interface OpenClawRPCResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}