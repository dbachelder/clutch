import cronstrue from "cronstrue"

export interface CronSchedule {
  kind: "cron" | "every" | "at"
  expr?: string
  everyMs?: number
  anchorMs?: number
  atMs?: number
  tz?: string
}

export function formatSchedule(schedule: CronSchedule): string {
  if (schedule.kind === "cron" && schedule.expr) {
    try {
      return cronstrue.toString(schedule.expr)
    } catch (error) {
      return `Invalid cron: ${schedule.expr}`
    }
  }
  
  if (schedule.kind === "every" && schedule.everyMs) {
    const seconds = schedule.everyMs / 1000
    if (seconds < 60) {
      return `Every ${seconds}s`
    } else if (seconds < 3600) {
      return `Every ${Math.floor(seconds / 60)}m`
    } else if (seconds < 86400) {
      return `Every ${Math.floor(seconds / 3600)}h`
    } else {
      return `Every ${Math.floor(seconds / 86400)}d`
    }
  }
  
  if (schedule.kind === "at" && schedule.atMs) {
    const date = new Date(schedule.atMs)
    return `At ${date.toLocaleString()}`
  }
  
  return "Unknown schedule"
}

export function formatRelativeTime(ms: number): string {
  const now = Date.now()
  const diff = now - ms
  
  if (diff < 0) {
    // Future time
    const absDiff = Math.abs(diff)
    if (absDiff < 60000) return "in moments"
    if (absDiff < 3600000) return `in ${Math.floor(absDiff / 60000)}m`
    if (absDiff < 86400000) return `in ${Math.floor(absDiff / 3600000)}h`
    return `in ${Math.floor(absDiff / 86400000)}d`
  }
  
  // Past time
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function formatAbsoluteTime(ms: number): string {
  const date = new Date(ms)
  return date.toLocaleString()
}

export interface CronJob {
  jobId: string
  name?: string
  schedule: CronSchedule
  enabled: boolean
  sessionTarget: "main" | "isolated"
  payload: any
  lastRunMs?: number
  nextRunMs?: number
}