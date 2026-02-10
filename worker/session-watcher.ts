import { ConvexHttpClient } from "convex/browser"
import { readdirSync, statSync, readFileSync, openSync, readSync, closeSync } from "node:fs"
import { homedir } from "node:os"
import { join, extname } from "node:path"
import { api } from "../convex/_generated/api"

const CONVEX_URL = process.env.CONVEX_URL ?? "http://127.0.0.1:3210"
const SESSIONS_DIR = join(homedir(), ".openclaw", "agents", "main", "sessions")
const SESSIONS_JSON_PATH = join(SESSIONS_DIR, "sessions.json")
const POLL_INTERVAL_MS = 3000
const STALE_THRESHOLD_MS = 5 * 60 * 1000

type SessionType = "main" | "chat" | "agent" | "cron"
type SessionStatus = "active" | "idle" | "completed" | "stale"

interface SessionsJsonEntry {
  sessionId: string
  sessionFile?: string
  updatedAt?: number
}

interface SessionsJson {
  [sessionKey: string]: SessionsJsonEntry
}

interface SessionData {
  sessionKey: string
  sessionId: string
  filePath: string
  fileMtimeMs: number
  sessionType: SessionType
  status: SessionStatus
  model?: string
  provider?: string
  stopReason?: string
  tokensInput?: number
  tokensOutput?: number
  tokensCacheRead?: number
  tokensCacheWrite?: number
  tokensTotal?: number
  costInput?: number
  costOutput?: number
  costCacheRead?: number
  costCacheWrite?: number
  costTotal?: number
  outputPreview?: string
  projectSlug?: string
  taskId?: string
}

const AGENT_ROLES = new Set([
  "dev", "reviewer", "pm", "research", "conflict_resolver",
  "analyzer", "fixer", "qa", "security"
])

function detectSessionType(sessionKey: string): SessionType {
  if (sessionKey === "agent:main:main") return "main"
  const agentMatch = sessionKey.match(/^agent:main:(?:clutch|trap):([^:]+):([a-f0-9]{8})$/)
  if (agentMatch && AGENT_ROLES.has(agentMatch[1])) return "agent"
  if (sessionKey.match(/^agent:main:(?:clutch|trap):[^:]+:/)) return "chat"
  if (sessionKey.match(/^agent:main:cron:.*:(?:clutch|trap)-/)) return "agent"
  if (sessionKey.startsWith("agent:main:cron:")) return "cron"
  return "cron"
}

function extractProjectSlug(sessionKey: string): string | undefined {
  const chatMatch = sessionKey.match(/^agent:main:(?:clutch|trap):([^:]+):/)
  if (chatMatch) return chatMatch[1]
  if (sessionKey.match(/:(?:clutch|trap)-/)) return "clutch"
  return undefined
}

/**
 * Read the last N lines of a file by reading a chunk from the end.
 * Pure Node.js — no external `tail` dependency.
 */
function readLastLines(filePath: string, lineCount: number, chunkSize = 8192): string[] {
  try {
    const stats = statSync(filePath)
    if (stats.size === 0) return []
    const fd = openSync(filePath, "r")
    try {
      const readSize = Math.min(chunkSize, stats.size)
      const buffer = Buffer.alloc(readSize)
      readSync(fd, buffer, 0, readSize, stats.size - readSize)
      const text = buffer.toString("utf-8")
      const lines = text.split("\n").filter(Boolean)
      return lines.slice(-lineCount)
    } finally {
      closeSync(fd)
    }
  } catch {
    return []
  }
}

function parseLastMessage(line: string): {
  model: string
  provider: string
  stopReason: string
  usage: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    total: number
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number }
  }
  textPreview: string
  isDone: boolean
} | null {
  try {
    const entry = JSON.parse(line) as {
      message?: {
        role?: string
        model?: string
        provider?: string
        stopReason?: string
        usage?: {
          input?: number
          output?: number
          cacheRead?: number
          cacheWrite?: number
          totalTokens?: number
          cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; total?: number }
        }
        content?: Array<{ type: string; text?: string }>
      }
    }
    const msg = entry.message
    if (!msg || msg.role !== "assistant") return null
    const usage = msg.usage
    const textPreview = (msg.content || [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("")
      .slice(0, 500)
    return {
      model: msg.model ?? "unknown",
      provider: msg.provider ?? "unknown",
      stopReason: msg.stopReason ?? "unknown",
      usage: {
        input: usage?.input ?? 0,
        output: usage?.output ?? 0,
        cacheRead: usage?.cacheRead ?? 0,
        cacheWrite: usage?.cacheWrite ?? 0,
        total: usage?.totalTokens ?? 0,
        cost: {
          input: usage?.cost?.input ?? 0,
          output: usage?.cost?.output ?? 0,
          cacheRead: usage?.cost?.cacheRead ?? 0,
          cacheWrite: usage?.cost?.cacheWrite ?? 0,
          total: usage?.cost?.total ?? 0
        }
      },
      textPreview,
      isDone: msg.stopReason === "stop"
    }
  } catch {
    return null
  }
}

function findLastAssistantMessage(lines: string[]) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const result = parseLastMessage(lines[i])
    if (result) return result
  }
  return null
}

function hasTerminalError(filePath: string): boolean {
  try {
    const lines = readLastLines(filePath, 3)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as {
          message?: { role?: string; content?: Array<{ type: string; text?: string }> }
          isError?: boolean
        }
        if (
          entry.message?.role === "toolResult" &&
          entry.isError === true &&
          entry.message.content?.some(
            (c) => c.type === "text" && c.text?.includes("synthetic error result for transcript repair")
          )
        ) {
          return true
        }
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return false
}

function determineStatus(isDone: boolean, hasAssistantMessage: boolean, fileMtimeMs: number): SessionStatus {
  if (isDone) return "completed"
  if (!hasAssistantMessage) return "idle"
  if (Date.now() - fileMtimeMs > STALE_THRESHOLD_MS) return "stale"
  return "active"
}

class SessionCache {
  private data: SessionsJson = {}
  private mtimeMs = 0
  private fileToKey = new Map<string, string>()

  refresh(): void {
    try {
      const stats = statSync(SESSIONS_JSON_PATH)
      if (stats.mtimeMs === this.mtimeMs) return
      const content = readFileSync(SESSIONS_JSON_PATH, "utf-8")
      this.data = JSON.parse(content) as SessionsJson
      this.mtimeMs = stats.mtimeMs
      this.fileToKey.clear()
      for (const [key, entry] of Object.entries(this.data)) {
        const filePath = entry.sessionFile ?? join(SESSIONS_DIR, `${entry.sessionId}.jsonl`)
        this.fileToKey.set(filePath, key)
      }
    } catch {
      // keep existing cache
    }
  }

  getSessionKey(filePath: string): string | undefined {
    return this.fileToKey.get(filePath)
  }

  getSessionId(sessionKey: string): string | undefined {
    return this.data[sessionKey]?.sessionId
  }

  isLegacyTrap(sessionKey: string): boolean {
    return sessionKey.includes(":trap:") || sessionKey.includes(":trap-")
  }
}

class FileScanner {
  private fileMtimes = new Map<string, number>()

  scan(): string[] {
    const changedFiles: string[] = []
    try {
      const entries = readdirSync(SESSIONS_DIR, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile() || extname(entry.name) !== ".jsonl") continue
        const filePath = join(SESSIONS_DIR, entry.name)
        try {
          const stats = statSync(filePath)
          const lastMtime = this.fileMtimes.get(filePath) ?? 0
          if (stats.mtimeMs > lastMtime) {
            changedFiles.push(filePath)
            this.fileMtimes.set(filePath, stats.mtimeMs)
          }
        } catch {
          // skip
        }
      }
    } catch {
      // directory might not exist
    }
    return changedFiles
  }
}

class SessionWatcher {
  private convex: ConvexHttpClient
  private cache = new SessionCache()
  private scanner = new FileScanner()
  private pollTimer: NodeJS.Timeout | null = null
  private reconcileTimer: NodeJS.Timeout | null = null
  private running = false
  private static RECONCILE_INTERVAL_MS = 60_000 // check for stale sessions every 60s

  constructor() {
    this.convex = new ConvexHttpClient(CONVEX_URL)
  }

  async start(): Promise<void> {
    console.log("[SessionWatcher] Starting (poll-based)...")
    console.log(`[SessionWatcher] Convex URL: ${CONVEX_URL}`)

    try {
      await this.convex.query(api.sessions.list, { limit: 1 })
      console.log("[SessionWatcher] Connected to Convex")
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[SessionWatcher] Failed to connect to Convex: ${msg}`)
      process.exit(1)
    }

    this.cache.refresh()
    this.running = true
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
    // Periodically reconcile: mark Convex sessions as stale/completed if their
    // JSONL files haven't been touched or if they no longer appear in OpenClaw
    this.reconcileTimer = setInterval(() => this.reconcileStale(), SessionWatcher.RECONCILE_INTERVAL_MS)

    process.on("SIGTERM", () => this.stop())
    process.on("SIGINT", () => this.stop())

    console.log("[SessionWatcher] Ready")
  }

  stop(): void {
    console.log("[SessionWatcher] Shutting down...")
    this.running = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer)
      this.reconcileTimer = null
    }
    console.log("[SessionWatcher] Goodbye")
    process.exit(0)
  }

  /**
   * Periodic reconciliation (runs every 60s):
   *
   * Step 1: Already handled by poll() — changed files get synced to Convex.
   *
   * Step 2: Active sessions NOT updated in step 1 — inspect JSONL:
   *   a. Clear stop signal (stopReason=stop/end_turn) → mark completed
   *   b. toolUse stopReason + file untouched for 10min → mark completed (stuck mid-tool)
   *   c. Log ALL transitions with stopReason and timestamps
   *
   * Step 3: Tasks with agent_session_key not accounted for → log as urgent bug
   */
  private async reconcileStale(): Promise<void> {
    if (!this.running) return

    const now = Date.now()
    const TOOL_USE_GRACE_MS = 10 * 60 * 1000 // 10 minutes for toolUse

    try {
      // --- Step 2: Check active sessions that poll() didn't touch ---
      const convexActive = await this.convex.query(api.sessions.list, {
        status: "active",
        sessionType: "agent",
        limit: 200,
      })

      if (!convexActive || convexActive.length === 0) {
        // No active agent sessions — skip to step 3
        await this.reconcileOrphanedTasks(new Set())
        return
      }

      // Track which session keys we've accounted for
      const accountedKeys = new Set<string>()
      let reconciled = 0

      for (const session of convexActive) {
        const sessionKey = session.session_key
        const filePath = session.file_path

        if (!filePath) {
          // No file path — check last_active_at age
          const lastActive = session.last_active_at ?? session.updated_at ?? 0
          if (now - lastActive > TOOL_USE_GRACE_MS) {
            console.log(
              `[Reconcile] ${sessionKey}: no file path, last active ${Math.round((now - lastActive) / 60000)}min ago → completed`
            )
            await this.markSessionCompleted(session, "no_file_path_stale")
            reconciled++
          } else {
            accountedKeys.add(sessionKey)
          }
          continue
        }

        // Read the JSONL to inspect the last message
        let fileMtimeMs: number
        try {
          const stats = statSync(filePath)
          fileMtimeMs = stats.mtimeMs
        } catch {
          // File doesn't exist — session is dead
          console.log(`[Reconcile] ${sessionKey}: JSONL file missing → completed`)
          await this.markSessionCompleted(session, "file_missing")
          reconciled++
          continue
        }

        const fileAgeMs = now - fileMtimeMs
        const lastLines = readLastLines(filePath, 5)
        const lastMsg = lastLines.length > 0 ? findLastAssistantMessage(lastLines) : null
        const isTerminalError = hasTerminalError(filePath)
        const stopReason = lastMsg?.stopReason ?? "unknown"

        // 2a. Clear stop signal → mark completed immediately
        if (lastMsg?.isDone || isTerminalError) {
          console.log(
            `[Reconcile] ${sessionKey}: clear stop signal (stopReason=${stopReason}, terminal=${isTerminalError}) → completed`
          )
          await this.markSessionCompleted(session, stopReason)
          reconciled++
          continue
        }

        // 2b. toolUse — wait 10 minutes before marking dead
        if (stopReason === "toolUse" || stopReason === "tool_use") {
          if (fileAgeMs > TOOL_USE_GRACE_MS) {
            console.log(
              `[Reconcile] ${sessionKey}: toolUse stuck for ${Math.round(fileAgeMs / 60000)}min (threshold: 10min) → completed`
            )
            await this.markSessionCompleted(session, `toolUse_timeout_${Math.round(fileAgeMs / 60000)}min`)
            reconciled++
            continue
          } else {
            // Still within grace period — leave it alone
            accountedKeys.add(sessionKey)
            continue
          }
        }

        // 2c. Unknown/other stopReason + file hasn't changed in 10min
        if (fileAgeMs > TOOL_USE_GRACE_MS) {
          console.log(
            `[Reconcile] ${sessionKey}: inactive ${Math.round(fileAgeMs / 60000)}min, stopReason=${stopReason} → completed`
          )
          await this.markSessionCompleted(session, `inactive_${stopReason}`)
          reconciled++
          continue
        }

        // Session looks alive — account for it
        accountedKeys.add(sessionKey)
      }

      if (reconciled > 0) {
        console.log(`[Reconcile] Marked ${reconciled} sessions as completed`)
      }

      // --- Step 3: Find orphaned tasks ---
      await this.reconcileOrphanedTasks(accountedKeys)

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Reconcile] Error: ${msg}`)
    }
  }

  /**
   * Mark a session as completed in Convex with logging.
   */
  private async markSessionCompleted(
    session: { session_key: string; session_id: string; session_type: string | null },
    reason: string,
  ): Promise<void> {
    try {
      await this.convex.mutation(api.sessions.upsert, {
        sessionKey: session.session_key,
        sessionId: session.session_id,
        sessionType: (session.session_type ?? "agent") as SessionType,
        status: "completed",
        stopReason: reason,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Reconcile] Failed to mark ${session.session_key} as completed: ${msg}`)
    }
  }

  /**
   * Step 3: Find tasks with agent_session_key that point to sessions
   * we haven't accounted for in steps 1 & 2. These are bugs — an agent
   * was assigned but we have no record of it running or stopping.
   */
  private async reconcileOrphanedTasks(accountedKeys: Set<string>): Promise<void> {
    try {
      // Get all in_progress and in_review tasks across all projects
      const projects = await this.convex.query(api.projects.getAll, {})

      for (const project of projects) {
        for (const status of ["in_progress", "in_review"] as const) {
          const tasks = await this.convex.query(api.tasks.getByProject, {
            projectId: project.id,
            status,
          })

          for (const task of tasks) {
            if (!task.agent_session_key) continue

            // Was this session accounted for in step 1 (poll) or step 2 (reconcile)?
            if (accountedKeys.has(task.agent_session_key)) continue

            // Check if this session exists in Convex at all
            const sessionStatus = await this.convex.query(api.sessions.getLiveStatus, {
              sessionKey: task.agent_session_key,
            })

            if (sessionStatus.exists && sessionStatus.status === "active") {
              // Active in Convex but not in our accountedKeys — we missed it
              // This shouldn't happen if reconcile ran correctly
              continue
            }

            if (sessionStatus.exists && (sessionStatus.status === "completed" || sessionStatus.status === "stale")) {
              // Session is done but task still has it assigned — task is stuck
              console.error(
                `[Reconcile] BUG: Task ${task.id.slice(0, 8)} (${status}) has agent ${task.agent_session_key} ` +
                `but session is ${sessionStatus.status}. Task is orphaned and needs attention!`
              )
              continue
            }

            if (!sessionStatus.exists) {
              // No session record at all — agent was assigned but never ran or record was lost
              console.error(
                `[Reconcile] BUG: Task ${task.id.slice(0, 8)} (${status}) has agent ${task.agent_session_key} ` +
                `but NO session record exists. Agent assignment is orphaned!`
              )
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Reconcile] Orphan check failed: ${msg}`)
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return

    this.cache.refresh()
    const changedFiles = this.scanner.scan()
    if (changedFiles.length === 0) return

    const sessions: SessionData[] = []

    for (const filePath of changedFiles) {
      const sessionKey = this.cache.getSessionKey(filePath)
      if (!sessionKey || this.cache.isLegacyTrap(sessionKey)) continue

      const sessionId = this.cache.getSessionId(sessionKey)
      if (!sessionId) continue

      const stats = statSync(filePath)
      const fileMtimeMs = stats.mtimeMs

      const lastLines = readLastLines(filePath, 5)
      const lastMsg = lastLines.length > 0 ? findLastAssistantMessage(lastLines) : null
      const isTerminalError = hasTerminalError(filePath)
      const isDone = (lastMsg?.isDone ?? false) || isTerminalError

      const sessionType = detectSessionType(sessionKey)
      let projectSlug = extractProjectSlug(sessionKey)
      const status = determineStatus(isDone, lastMsg !== null, fileMtimeMs)

      // Resolve task ID: look up tasks where agent_session_key matches
      // this session key. The task stores the full session key, so we
      // can match exactly without needing to expand the 8-char prefix.
      let taskId: string | undefined
      if (sessionType === "agent") {
        try {
          const task = await this.convex.query(api.tasks.getByAgentSessionKey, {
            agentSessionKey: sessionKey,
          })
          if (task) {
            taskId = task.id
            // BUG FIX: Resolve project slug from task's project_id
            // extractProjectSlug() returns undefined for agent sessions,
            // so we need to look up the actual project slug
            const resolvedSlug = await this.convex.query(api.projects.getSlugById, {
              projectId: task.project_id,
            })
            if (resolvedSlug) {
              projectSlug = resolvedSlug
            }
          }
        } catch {
          // non-fatal
        }

        // REGRESSION GUARD: Agent sessions with resolved tasks MUST have projectSlug
        if (taskId && !projectSlug) {
          console.error(
            `[SessionWatcher] REGRESSION: Agent session ${sessionKey} has taskId ${taskId} but no projectSlug`
          )
        }
      }

      sessions.push({
        sessionKey,
        sessionId,
        filePath,
        fileMtimeMs,
        sessionType,
        status,
        model: lastMsg?.model,
        provider: lastMsg?.provider,
        stopReason: lastMsg?.stopReason,
        tokensInput: lastMsg?.usage.input,
        tokensOutput: lastMsg?.usage.output,
        tokensCacheRead: lastMsg?.usage.cacheRead,
        tokensCacheWrite: lastMsg?.usage.cacheWrite,
        tokensTotal: lastMsg?.usage.total,
        costInput: lastMsg?.usage.cost.input,
        costOutput: lastMsg?.usage.cost.output,
        costCacheRead: lastMsg?.usage.cost.cacheRead,
        costCacheWrite: lastMsg?.usage.cost.cacheWrite,
        costTotal: lastMsg?.usage.cost.total,
        outputPreview: lastMsg?.textPreview,
        projectSlug,
        taskId
      })
    }

    if (sessions.length === 0) return

    try {
      const result = await this.convex.mutation(api.sessions.batchUpsert, {
        sessions: sessions.map((s) => ({
          sessionKey: s.sessionKey,
          sessionId: s.sessionId,
          sessionType: s.sessionType,
          status: s.status,
          model: s.model,
          provider: s.provider,
          tokensInput: s.tokensInput,
          tokensOutput: s.tokensOutput,
          tokensCacheRead: s.tokensCacheRead,
          tokensCacheWrite: s.tokensCacheWrite,
          tokensTotal: s.tokensTotal,
          costInput: s.costInput,
          costOutput: s.costOutput,
          costCacheRead: s.costCacheRead,
          costCacheWrite: s.costCacheWrite,
          costTotal: s.costTotal,
          lastActiveAt: s.fileMtimeMs,
          outputPreview: s.outputPreview,
          stopReason: s.stopReason,
          taskId: s.taskId,
          projectSlug: s.projectSlug,
          filePath: s.filePath,
          createdAt: Date.now()
        }))
      })

      if (result.count > 0) {
        console.log(`[SessionWatcher] Synced ${result.count} sessions`)
      }
      if (result.errors.length > 0) {
        console.error("[SessionWatcher] Errors:", result.errors)
      }
    } catch (error) {
      console.error("[SessionWatcher] Failed to sync:", error)
    }
  }
}

async function main(): Promise<void> {
  const watcher = new SessionWatcher()
  await watcher.start()
}

main().catch((error) => {
  console.error("[SessionWatcher] Fatal error:", error)
  process.exit(1)
})
