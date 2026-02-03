/**
 * OpenClaw Gateway API types
 */

export interface Session {
  key: string
  agentId: string
  model: string
  status: "running" | "idle" | "completed"
  inputTokens: number
  outputTokens: number
  startedAt: number
}

export interface CronJob {
  id: string
  name: string
  schedule: { kind: "cron" | "every"; expr?: string; everyMs?: number }
  enabled: boolean
  lastRunAtMs?: number
  nextRunAtMs?: number
}

export interface CronStatus {
  running: boolean
}

/**
 * Type-safe RPC method definitions
 */
export interface RpcMethods {
  "sessions.list": { 
    params: { kinds?: string[] } 
    result: Session[] 
  }
  "cron.list": { 
    params: Record<string, never>
    result: CronJob[] 
  }
  "cron.status": { 
    params: Record<string, never>
    result: CronStatus 
  }
}