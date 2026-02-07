"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { TaskDependencySummary, TaskSummary } from "@/lib/types"

interface DependenciesData {
  depends_on: TaskDependencySummary[]
  blocks: TaskSummary[]
}

interface UseConvexDependenciesReturn {
  dependencies: DependenciesData
  loading: boolean
  error: string | null
}

/**
 * Reactive Convex hook for fetching task dependencies.
 * 
 * Replaces the REST-based useDependencies hook with reactive Convex queries.
 * Updates automatically when dependencies change in the database.
 * 
 * @param taskId - The task ID to fetch dependencies for
 * @returns Object with depends_on and blocks arrays, loading state, and error
 */
export function useConvexDependencies(taskId: string | null): UseConvexDependenciesReturn {
  const result = useQuery(
    api.taskDependencies.getDependencySummary,
    taskId ? { taskId } : "skip"
  )

  return {
    dependencies: {
      depends_on: result?.depends_on ?? [],
      blocks: result?.blocks ?? [],
    },
    loading: result === undefined,
    error: null,
  }
}
