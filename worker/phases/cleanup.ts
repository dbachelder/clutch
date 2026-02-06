import { execFileSync } from "child_process"
import type { ConvexHttpClient } from "convex/browser"
import type { Task } from "@/lib/types"
import type {
  WorkLoopConfig,
  ChildManager,
  SessionsPoller,
  LogRunParams,
} from "../types"

// ============================================
// Types
// ============================================

interface CleanupContext {
  convex: ConvexHttpClient
  children: ChildManager
  sessions: SessionsPoller
  config: WorkLoopConfig
  cycle: number
  log: (params: LogRunParams) => Promise<void>
}

interface CleanupResult {
  actionsCount: number
}

// ============================================
// Constants
// ============================================

const MS_PER_MINUTE = 60 * 1000

// ============================================
// Main Cleanup Function
// ============================================

export async function runCleanup(ctx: CleanupContext): Promise<CleanupResult> {
  const { convex, children, sessions, config, cycle, log } = ctx
  let actionsCount = 0

  const now = Date.now()
  const staleTaskMs = config.staleTaskMinutes * MS_PER_MINUTE
  const staleReviewMs = config.staleReviewMinutes * MS_PER_MINUTE

  // Fetch tasks from Convex
  const inProgressTasks = await fetchTasksByStatus(convex, config.projectId, "in_progress")
  const inReviewTasks = await fetchTasksByStatus(convex, config.projectId, "in_review")

  // 1. Check in_progress tasks with no active session/child
  for (const task of inProgressTasks) {
    const taskAge = now - task.updated_at

    if (taskAge > staleTaskMs) {
      const hasSession = sessions.hasActiveSession(task.id)
      const hasChild = children.hasChild(task.id)

      if (!hasSession && !hasChild) {
        // Reset to ready
        await resetTaskToReady(convex, task)
        await log({
          projectId: config.projectId,
          cycle,
          phase: "cleanup",
          action: "reset_stale_in_progress",
          taskId: task.id,
          details: {
            reason: "no_active_session_or_child",
            ageMinutes: Math.round(taskAge / MS_PER_MINUTE),
          },
        })
        actionsCount++
      }
    }
  }

  // 2. Check in_review tasks with no open PR
  for (const task of inReviewTasks) {
    const taskAge = now - task.updated_at

    if (taskAge > staleReviewMs) {
      const hasOpenPR = await checkOpenPR(config.githubRepo, task.id)

      if (!hasOpenPR) {
        // Reset to ready
        await resetTaskToReady(convex, task)
        await log({
          projectId: config.projectId,
          cycle,
          phase: "cleanup",
          action: "reset_stale_in_review",
          taskId: task.id,
          details: {
            reason: "no_open_pr",
            ageMinutes: Math.round(taskAge / MS_PER_MINUTE),
          },
        })
        actionsCount++
      }
    }
  }

  // 3. Kill stale child processes
  const staleChildren = findStaleChildren(children, now, staleTaskMs)
  for (const [taskId, child] of staleChildren) {
    const killed = children.killChild(taskId)
    if (killed) {
      // Find and reset the task
      const task = inProgressTasks.find(t => t.id === taskId)
      if (task) {
        await resetTaskToReady(convex, task)
      }
      await log({
        projectId: config.projectId,
        cycle,
        phase: "cleanup",
        action: "kill_stale_child",
        taskId,
        details: {
          pid: child.pid,
          staleMinutes: Math.round((now - child.lastOutputAt) / MS_PER_MINUTE),
        },
      })
      actionsCount++
    }
  }

  // 4. Clean orphaned worktrees
  const orphanedWorktrees = await findOrphanedWorktrees(
    config.localPath,
    config.worktreesPath,
    inProgressTasks,
    inReviewTasks
  )
  for (const worktreePath of orphanedWorktrees) {
    const cleaned = await cleanWorktree(config.localPath, worktreePath)
    if (cleaned) {
      await log({
        projectId: config.projectId,
        cycle,
        phase: "cleanup",
        action: "clean_orphaned_worktree",
        details: {
          worktreePath,
        },
      })
      actionsCount++
    }
  }

  return { actionsCount }
}

// ============================================
// Helper Functions
// ============================================

async function fetchTasksByStatus(
  convex: ConvexHttpClient,
  projectId: string,
  status: "in_progress" | "in_review"
): Promise<Task[]> {
  const { api } = await import("@/convex/_generated/api")
  return convex.query(api.tasks.getByProject, { projectId, status })
}

async function resetTaskToReady(convex: ConvexHttpClient, task: Task): Promise<void> {
  const { api } = await import("@/convex/_generated/api")
  await convex.mutation(api.tasks.move, {
    id: task.id,
    status: "ready",
  })
}

async function checkOpenPR(githubRepo: string, taskId: string): Promise<boolean> {
  try {
    // Extract prefix from task ID (first 8 chars is typically enough)
    const idPrefix = taskId.slice(0, 8)
    const headPattern = `fix/${idPrefix}*`

    const result = execFileSync(
      "gh",
      ["pr", "list", "--repo", githubRepo, "--state", "open", "--head", headPattern, "--json", "number"],
      { encoding: "utf-8", timeout: 30000 }
    )

    const prs = JSON.parse(result) as Array<{ number: number }>
    return prs.length > 0
  } catch (error) {
    // If gh command fails, assume no PR (conservative)
    console.error(`[cleanup] Failed to check PR for task ${taskId}:`, error)
    return false
  }
}

function findStaleChildren(
  children: ChildManager,
  now: number,
  staleMs: number
): Map<string, { pid: number; lastOutputAt: number }> {
  const stale = new Map<string, { pid: number; lastOutputAt: number }>()

  for (const [taskId, child] of children.getAllChildren()) {
    const idleTime = now - child.lastOutputAt
    if (idleTime > staleMs) {
      stale.set(taskId, child)
    }
  }

  return stale
}

async function findOrphanedWorktrees(
  repoPath: string,
  worktreesPath: string,
  inProgressTasks: Task[],
  inReviewTasks: Task[]
): Promise<string[]> {
  const activeTaskIds = new Set([
    ...inProgressTasks.map(t => t.id),
    ...inReviewTasks.map(t => t.id),
  ])

  const orphaned: string[] = []

  try {
    // List all worktrees
    const result = execFileSync(
      "git",
      ["-C", repoPath, "worktree", "list", "--porcelain"],
      { encoding: "utf-8", timeout: 30000 }
    )

    // Parse worktree list
    const worktrees = parseWorktreeList(result)

    for (const worktree of worktrees) {
      // Check if this worktree is in the worktrees path
      if (!worktree.path.startsWith(worktreesPath)) {
        continue
      }

      // Extract task ID from worktree path
      const taskId = extractTaskIdFromWorktree(worktree.path)

      if (!taskId || !activeTaskIds.has(taskId)) {
        orphaned.push(worktree.path)
      }
    }
  } catch (error) {
    console.error("[cleanup] Failed to list worktrees:", error)
  }

  return orphaned
}

interface WorktreeInfo {
  path: string
  head: string
  branch?: string
  bare: boolean
}

function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = []
  let current: Partial<WorktreeInfo> = {}

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) {
        worktrees.push(current as WorktreeInfo)
      }
      current = { path: line.slice(9), bare: false }
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5)
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7)
    } else if (line === "bare") {
      current.bare = true
    } else if (line === "") {
      // End of worktree entry
      if (current.path) {
        worktrees.push(current as WorktreeInfo)
      }
      current = {}
    }
  }

  // Handle last entry
  if (current.path) {
    worktrees.push(current as WorktreeInfo)
  }

  return worktrees
}

function extractTaskIdFromWorktree(worktreePath: string): string | null {
  // Try to extract task ID from path
  // Format: .../trap-worktrees/fix/<uuid-prefix>-<description>
  const match = worktreePath.match(/fix\/([a-f0-9-]+)/)
  if (match) {
    return match[1]
  }
  return null
}

async function cleanWorktree(repoPath: string, worktreePath: string): Promise<boolean> {
  try {
    // Check for uncommitted changes
    const statusResult = execFileSync(
      "git",
      ["-C", worktreePath, "status", "--porcelain"],
      { encoding: "utf-8", timeout: 30000 }
    )

    if (statusResult.trim().length > 0) {
      console.warn(`[cleanup] Worktree ${worktreePath} has uncommitted changes, skipping`)
      return false
    }

    // Remove the worktree
    execFileSync(
      "git",
      ["-C", repoPath, "worktree", "remove", worktreePath, "--force"],
      { timeout: 30000 }
    )

    return true
  } catch (error) {
    console.error(`[cleanup] Failed to clean worktree ${worktreePath}:`, error)
    return false
  }
}
