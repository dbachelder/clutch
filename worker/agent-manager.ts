/**
 * Agent Manager
 *
 * Manages agent sessions via the OpenClaw gateway WebSocket RPC.
 * Replaces the ChildManager (child_process.spawn) approach.
 *
 * Each agent is a long-running RPC call to the gateway. The gateway
 * creates a real session that is fully trackable (tokens, model, activity).
 *
 * NOTE: This implementation uses Convex as the source of truth for active
 * agents. There is no in-memory Map — agent state is stored in the database
 * with agent_session_key and agent_spawned_at fields on tasks.
 */

import type { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { getGatewayClient, type GatewayRpcClient } from "./gateway-client"
import { SessionFileReader } from "./session-file-reader"

// ============================================
// Types
// ============================================

export interface AgentOutcome {
  taskId: string
  projectId: string
  sessionKey: string
  role: string
  success: boolean
  reply?: string
  error?: string
  durationMs: number
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export interface SpawnAgentParams {
  taskId: string
  projectId: string
  projectSlug: string
  role: string
  message: string
  model?: string
  thinking?: string
  timeoutSeconds?: number
  retryCount?: number
}

// ============================================
// Agent Manager
// ============================================

export class AgentManager {
  private gateway: GatewayRpcClient
  private sessionFileReader: SessionFileReader
  /** Timestamp when this loop started. Used to ignore stale session files from previous runs. */
  private loopStartedAt: number

  constructor() {
    this.gateway = getGatewayClient()
    this.sessionFileReader = new SessionFileReader()
    this.loopStartedAt = Date.now()
  }

  /**
   * Spawn a new agent via the gateway.
   *
   * This sends an async RPC call that will run until the agent completes.
   * The agent is tracked in Convex (via agent_session_key and agent_spawned_at
   * on the task), NOT in an in-memory Map.
   *
   * NOTE: This is fire-and-forget. The gateway runs the agent asynchronously.
   * Agent completion is detected by reapFinished() which polls Convex and
   * checks session JSONL files.
   */
  async spawn(params: SpawnAgentParams): Promise<{ sessionKey: string }> {
    // Ensure gateway connection
    await this.gateway.connect()

    const retryCount = params.retryCount ?? 0
    const sessionKey = retryCount > 0
      ? `agent:main:${params.projectSlug}:${params.role}:${params.taskId.slice(0, 8)}:r${retryCount}`
      : `agent:main:${params.projectSlug}:${params.role}:${params.taskId.slice(0, 8)}`

    // The gateway accepts the agent run and executes it asynchronously.
    // This call returns quickly with status: "accepted".
    // The actual session is trackable via sessions.list.
    await this.gateway.runAgent({
      message: params.message,
      sessionKey,
      model: params.model,
      thinking: params.thinking ?? "off",
      // timeout=0 means "no timeout" — omit the field so OpenClaw uses its default
      // If caller wants no timeout (staleness handled by loop reaper), pass 0 → omit
      ...(params.timeoutSeconds ? { timeout: params.timeoutSeconds } : {}),
    })

    // Agent was accepted — it's now running on the gateway.
    // Agent state is stored in Convex (agent_session_key, agent_spawned_at).
    // reapFinished() will detect completion by checking JSONL files.
    return { sessionKey }
  }

  /**
   * Reap finished and stale agents by querying Convex and reading session JSONL files.
   *
   * Queries Convex for all tasks with agent_session_key != null AND status in
   * (in_progress, in_review). For each, checks the session JSONL file via
   * SessionFileReader to detect completion or staleness.
   *
   * Three conditions:
   * 1. **Done**: Last assistant message has stopReason === "stop" → reap as finished
   * 2. **Stale**: File mtime is older than staleMs AND not done → reap as stale
   * 3. **Working**: File mtime is recent OR stopReason === "toolUse" → leave alone
   *
   * @param staleMs - Milliseconds of inactivity before a session is considered stuck.
   *                  Default: 5 minutes (300_000 ms).
   * @param convex - Convex HTTP client for querying active tasks
   */
  async reapFinished(
    convex: ConvexHttpClient,
    staleMs = 5 * 60 * 1000,
    staleReviewMs?: number
  ): Promise<{ reaped: AgentOutcome[] }> {
    // Query Convex for all active agent tasks (in_progress or in_review with session key)
    const activeTasks = await convex.query(api.tasks.getAllActiveAgentTasks, {})

    if (activeTasks.length === 0) {
      return { reaped: [] }
    }

    const reaped: AgentOutcome[] = []
    const now = Date.now()

    for (const task of activeTasks) {
      const sessionKey = task.agent_session_key!
      const spawnedAt = task.agent_spawned_at ?? now

      const effectiveStaleMs = task.role === "reviewer" && staleReviewMs != null
        ? staleReviewMs
        : staleMs

      const info = this.sessionFileReader.getSessionInfo(sessionKey, effectiveStaleMs)

      // Ignore stale session files from previous loop runs
      // This prevents false tombstones when the loop restarts
      if (info && info.fileMtimeMs < this.loopStartedAt) {
        continue
      }

      let reason: "finished" | "stale" | null = null
      let outcomeUsage: AgentOutcome["usage"] = undefined
      let replyText = ""

      if (!info) {
        // Session file not found yet — agent may still be starting up.
        // Only treat as finished if the agent has been running for a while.
        const agentAgeMs = now - spawnedAt
        if (agentAgeMs < 10 * 60_000) {
          // Agent was spawned less than 10min ago — give it time to create its session file
          continue
        }
        // Session file still missing after grace period — treat as failed/gone
        reason = "finished"
        replyText = "completed"
      } else if (info.isDone) {
        // Session completed — either stopReason === "stop" (normal) or
        // terminal error (OpenClaw killed the run due to timeout)
        reason = "finished"
        if (info.isTerminalError) {
          replyText = "terminal_error"
          console.log(
            `[AgentManager] Session ${sessionKey} ended with terminal error ` +
            `(OpenClaw embedded run timeout). Will be reaped as finished.`,
          )
        } else {
          replyText = info.lastAssistantMessage?.textPreview ?? "completed"
        }
        outcomeUsage = info.lastAssistantMessage
          ? {
              inputTokens: info.lastAssistantMessage.usage.input,
              outputTokens: info.lastAssistantMessage.usage.output,
              totalTokens: info.lastAssistantMessage.usage.total,
            }
          : undefined
      } else if (info.isStale) {
        // File mtime is old and session is not done → stale
        reason = "stale"
        replyText = "stale_timeout"
        outcomeUsage = info.lastAssistantMessage
          ? {
              inputTokens: info.lastAssistantMessage.usage.input,
              outputTokens: info.lastAssistantMessage.usage.output,
              totalTokens: info.lastAssistantMessage.usage.total,
            }
          : undefined

        // Kill the stuck session on the gateway
        try {
          await this.gateway.deleteSession(sessionKey)
          console.log(
            `[AgentManager] Killed stale session ${sessionKey} ` +
            `(mtime ${Math.round((now - info.fileMtimeMs) / 1000)}s ago, threshold ${Math.round(staleMs / 1000)}s)`,
          )
        } catch (killError) {
          const msg = killError instanceof Error ? killError.message : String(killError)
          console.warn(`[AgentManager] Failed to kill stale session ${sessionKey}: ${msg}`)
          // Still reap the task — the session may be in a broken state
        }
      } else {
        // Session is still active (recent mtime or mid-tool-call)
        continue
      }

      if (reason) {
        const outcome: AgentOutcome = {
          taskId: task.id,
          projectId: task.project_id,
          sessionKey,
          role: task.role ?? "dev",
          success: reason === "finished",
          reply: replyText,
          error: reason === "stale" ? `Agent stale for >${Math.round(staleMs / 60_000)}min` : undefined,
          durationMs: now - spawnedAt,
          usage: outcomeUsage,
        }
        reaped.push(outcome)
      }
    }

    if (reaped.length > 0) {
      console.log(
        `[AgentManager] Reaped ${reaped.length} agent(s): ` +
        reaped.map((r) => `${r.sessionKey} (${r.reply})`).join(", "),
      )
    }

    return { reaped }
  }

  /**
   * Disconnect from the gateway and clean up.
   */
  shutdown(): void {
    this.gateway.disconnect()
  }
}

// ============================================
// Singleton
// ============================================

export const agentManager = new AgentManager()
