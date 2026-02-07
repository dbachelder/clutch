"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { AgentSession } from "@/convex/tasks"

export type { AgentSession }

/**
 * Reactive Convex subscription for agent sessions.
 *
 * Returns sessions derived from tasks that have agent_session_key set,
 * updated in real-time whenever tasks are updated in Convex.
 *
 * This replaces the openclaw sessions CLI dependency for the Sessions tab.
 *
 * Falls back gracefully if Convex provider is not available.
 */
export function useAgentSessions(projectId: string, limit?: number): {
  sessions: AgentSession[] | null
  isLoading: boolean
} {
  const result = useQuery(
    api.tasks.getAgentSessions,
    projectId ? { projectId, limit } : "skip"
  )

  return {
    sessions: result ?? null,
    isLoading: result === undefined,
  }
}
