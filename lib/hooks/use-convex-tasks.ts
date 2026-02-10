"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Task, TaskStatus } from "@/lib/types"
import { useState, useCallback, useMemo } from "react"

/**
 * Reactive Convex subscription for tasks by project and status.
 * 
 * Returns tasks updated in real-time whenever tasks are created,
 * updated, moved, or deleted in Convex.
 * 
 * Falls back gracefully if Convex provider is not available.
 */
export function useConvexTasks(
  projectId: string | null,
  status?: TaskStatus
): {
  tasks: Task[] | null
  isLoading: boolean
  error: Error | null
} {
  const result = useQuery(
    api.tasks.getByProject,
    projectId ? { projectId, status } : "skip"
  )

  return {
    tasks: result ?? null,
    isLoading: result === undefined,
    error: null,
  }
}

/**
 * Reactive Convex subscription for a single task with comments.
 * 
 * Returns task data updated in real-time whenever the task or its
 * comments change in Convex.
 */
export function useConvexTask(
  taskId: string | null
): {
  task: Task | null
  comments: unknown[] | null
  isLoading: boolean
  error: Error | null
} {
  const result = useQuery(
    api.tasks.getById,
    taskId ? { id: taskId } : "skip"
  )

  return {
    task: result?.task ?? null,
    comments: result?.comments ?? null,
    isLoading: result === undefined,
    error: null,
  }
}

/**
 * Hook that returns tasks grouped by status for the board columns.
 * 
 * Uses Convex reactive queries for real-time updates.
 */
export function useConvexBoardTasks(
  projectId: string | null
): {
  tasksByStatus: Record<TaskStatus, Task[]>
  isLoading: boolean
  error: Error | null
} {
  // Subscribe to all tasks for the project
  const { tasks, isLoading, error } = useConvexTasks(projectId)

  // Group tasks by status
  const tasksByStatus: Record<TaskStatus, Task[]> = {
    backlog: [],
    ready: [],
    in_progress: [],
    in_review: [],
    blocked: [],
    done: [],
  }

  if (tasks) {
    for (const task of tasks) {
      tasksByStatus[task.status].push(task)
    }

    // Sort each column
    for (const status of Object.keys(tasksByStatus) as TaskStatus[]) {
      if (status === "done") {
        // Done column: most recently completed first
        tasksByStatus[status].sort((a, b) => {
          const aTime = a.completed_at ?? a.updated_at
          const bTime = b.completed_at ?? b.updated_at
          return bTime - aTime
        })
      } else {
        tasksByStatus[status].sort((a, b) => a.position - b.position)
      }
    }
  }

  return {
    tasksByStatus,
    isLoading,
    error,
  }
}

// Default number of tasks to show per column
const DEFAULT_PAGE_SIZE = 25
const DONE_COLUMN_PAGE_SIZE = 10  // Smaller initial batch for done column

/**
 * Hook that returns paginated tasks for each board column.
 * Uses a single reactive query for all tasks to ensure consistent real-time updates.
 * 
 * Previously, this used 6 separate useQuery calls (one per column), which caused
 * race conditions when tasks moved between columns - the source and target columns
 * would update at different times, causing cards to briefly appear in both or
 * disappear entirely.
 */
export function usePaginatedBoardTasks(
  projectId: string | null
): {
  tasksByStatus: Record<TaskStatus, Task[]>
  totalCounts: Record<TaskStatus, number>
  isLoading: boolean
  error: Error | null
  hasMore: Record<TaskStatus, boolean>
  loadMore: (status: TaskStatus) => void
} {
  // Track page size per column (starts at DEFAULT_PAGE_SIZE, grows with "load more")
  const [pageSizes, setPageSizes] = useState<Record<TaskStatus, number>>({
    backlog: DEFAULT_PAGE_SIZE,
    ready: DEFAULT_PAGE_SIZE,
    in_progress: DEFAULT_PAGE_SIZE,
    in_review: DEFAULT_PAGE_SIZE,
    blocked: DEFAULT_PAGE_SIZE,
    done: DONE_COLUMN_PAGE_SIZE,
  })

  // Use a single reactive query for all tasks - this ensures consistent real-time updates
  // When a task moves between columns, all columns update atomically from the same data source
  const allTasks = useQuery(
    api.tasks.getByProject,
    projectId ? { projectId } : "skip"
  )

  const isLoading = allTasks === undefined

  // Group, sort, and paginate tasks by status - memoized for performance
  const { tasksByStatus, totalCounts, hasMore } = useMemo<{
    tasksByStatus: Record<TaskStatus, Task[]>
    totalCounts: Record<TaskStatus, number>
    hasMore: Record<TaskStatus, boolean>
  }>(() => {
    // Initialize empty result
    const result: Record<TaskStatus, Task[]> = {
      backlog: [],
      ready: [],
      in_progress: [],
      in_review: [],
      blocked: [],
      done: [],
    }

    const counts: Record<TaskStatus, number> = {
      backlog: 0,
      ready: 0,
      in_progress: 0,
      in_review: 0,
      blocked: 0,
      done: 0,
    }

    const noMore: Record<TaskStatus, boolean> = {
      backlog: false,
      ready: false,
      in_progress: false,
      in_review: false,
      blocked: false,
      done: false,
    }

    if (!allTasks) {
      return { tasksByStatus: result, totalCounts: counts, hasMore: noMore }
    }

    // Group tasks by status
    for (const task of allTasks) {
      if (result[task.status]) {
        result[task.status].push(task)
      }
    }

    // Sort each group and apply pagination
    for (const status of Object.keys(result) as TaskStatus[]) {
      const tasks = result[status]
      counts[status] = tasks.length

      // Sort tasks
      if (status === "done") {
        // Done column: most recently completed first
        tasks.sort((a, b) => {
          const aTime = a.completed_at ?? a.updated_at
          const bTime = b.completed_at ?? b.updated_at
          return bTime - aTime
        })
      } else {
        // Other columns: by position
        tasks.sort((a, b) => a.position - b.position)
      }

      // Apply pagination - slice to page size
      const limit = pageSizes[status]
      result[status] = tasks.slice(0, limit)
    }

    // Calculate hasMore for each column
    const more: Record<TaskStatus, boolean> = {
      backlog: result.backlog.length < counts.backlog,
      ready: result.ready.length < counts.ready,
      in_progress: result.in_progress.length < counts.in_progress,
      in_review: result.in_review.length < counts.in_review,
      blocked: result.blocked.length < counts.blocked,
      done: result.done.length < counts.done,
    }

    return { tasksByStatus: result, totalCounts: counts, hasMore: more }
  }, [allTasks, pageSizes])

  // Load more function - increases page size for a specific column
  const loadMore = useCallback((status: TaskStatus) => {
    const increment = status === 'done' ? DONE_COLUMN_PAGE_SIZE : DEFAULT_PAGE_SIZE
    setPageSizes((prev) => ({
      ...prev,
      [status]: prev[status] + increment,
    }))
  }, [])

  return {
    tasksByStatus,
    totalCounts,
    isLoading,
    error: null,
    hasMore,
    loadMore,
  }
}
