/**
 * Sessions API
 *
 * Queries and mutations for OpenClaw session management.
 * Session data is synced from JSONL files by the session-watcher worker.
 */

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

// ============================================
// Types
// ============================================

export type SessionType = "main" | "chat" | "agent" | "cron"
export type SessionStatus = "active" | "completed" | "stale"

export interface SessionInput {
  id: string // session key
  session_id: string
  name: string
  type: SessionType
  status: SessionStatus
  model: string
  project_slug?: string
  task_id?: string
  tokens_input?: number
  tokens_output?: number
  tokens_cache_read?: number
  tokens_cache_write?: number
  tokens_total?: number
  cost_input?: number
  cost_output?: number
  cost_cache_read?: number
  cost_cache_write?: number
  cost_total?: number
  file_path?: string
  file_mtime_ms?: number
  created_at: number
  updated_at: number
  completed_at?: number
  last_activity_at?: number
  stop_reason?: string
  is_terminal_error?: boolean
  output_preview?: string
}

// ============================================
// Queries
// ============================================

/**
 * Get all sessions, optionally filtered by status or type.
 */
export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("stale")
    )),
    type: v.optional(v.union(
      v.literal("main"),
      v.literal("chat"),
      v.literal("agent"),
      v.literal("cron")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"sessions">[]> => {
    let sessions = await ctx.db.query("sessions").collect()

    if (args.status) {
      sessions = sessions.filter((s) => s.status === args.status)
    }

    if (args.type) {
      sessions = sessions.filter((s) => s.type === args.type)
    }

    // Sort by updated_at desc
    sessions.sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))

    if (args.limit && args.limit > 0) {
      sessions = sessions.slice(0, args.limit)
    }

    return sessions
  },
})

/**
 * Get a single session by its session key (id).
 */
export const get = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"sessions"> | null> => {
    return await ctx.db.query("sessions").withIndex("by_session_key", (q) =>
      q.eq("id", args.id)
    ).unique()
  },
})

/**
 * Get sessions by project slug.
 */
export const getByProjectSlug = query({
  args: {
    project_slug: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"sessions">[]> => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_project_slug", (q) => q.eq("project_slug", args.project_slug))
      .collect()

    // Sort by updated_at desc
    sessions.sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))

    return sessions
  },
})

/**
 * Get sessions by task ID.
 */
export const getByTaskId = query({
  args: {
    task_id: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"sessions">[]> => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_task_id", (q) => q.eq("task_id", args.task_id))
      .collect()

    return sessions
  },
})

/**
 * Get session count by status (for dashboard stats).
 */
export const countByStatus = query({
  args: {},
  handler: async (ctx): Promise<Record<SessionStatus, number>> => {
    const sessions = await ctx.db.query("sessions").collect()

    const counts: Record<SessionStatus, number> = {
      active: 0,
      completed: 0,
      stale: 0,
    }

    for (const session of sessions) {
      counts[session.status as SessionStatus]++
    }

    return counts
  },
})

// ============================================
// Mutations
// ============================================

/**
 * Upsert a single session.
 * Creates new or updates existing session based on session key (id).
 */
export const upsert = mutation({
  args: {
    id: v.string(),
    session_id: v.string(),
    name: v.string(),
    type: v.union(v.literal("main"), v.literal("chat"), v.literal("agent"), v.literal("cron")),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("stale")),
    model: v.string(),
    project_slug: v.optional(v.string()),
    task_id: v.optional(v.string()),
    tokens_input: v.optional(v.number()),
    tokens_output: v.optional(v.number()),
    tokens_cache_read: v.optional(v.number()),
    tokens_cache_write: v.optional(v.number()),
    tokens_total: v.optional(v.number()),
    cost_input: v.optional(v.number()),
    cost_output: v.optional(v.number()),
    cost_cache_read: v.optional(v.number()),
    cost_cache_write: v.optional(v.number()),
    cost_total: v.optional(v.number()),
    file_path: v.optional(v.string()),
    file_mtime_ms: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
    completed_at: v.optional(v.number()),
    last_activity_at: v.optional(v.number()),
    stop_reason: v.optional(v.string()),
    is_terminal_error: v.optional(v.boolean()),
    output_preview: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ id: string }> => {
    // Check if session already exists
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_key", (q) => q.eq("id", args.id))
      .unique()

    if (existing) {
      // Update existing session
      await ctx.db.patch(existing._id, {
        session_id: args.session_id,
        name: args.name,
        type: args.type,
        status: args.status,
        model: args.model,
        project_slug: args.project_slug,
        task_id: args.task_id,
        tokens_input: args.tokens_input,
        tokens_output: args.tokens_output,
        tokens_cache_read: args.tokens_cache_read,
        tokens_cache_write: args.tokens_cache_write,
        tokens_total: args.tokens_total,
        cost_input: args.cost_input,
        cost_output: args.cost_output,
        cost_cache_read: args.cost_cache_read,
        cost_cache_write: args.cost_cache_write,
        cost_total: args.cost_total,
        file_path: args.file_path,
        file_mtime_ms: args.file_mtime_ms,
        updated_at: args.updated_at,
        completed_at: args.completed_at,
        last_activity_at: args.last_activity_at,
        stop_reason: args.stop_reason,
        is_terminal_error: args.is_terminal_error,
        output_preview: args.output_preview,
      })
      return { id: existing._id }
    } else {
      // Create new session
      const id = await ctx.db.insert("sessions", args)
      return { id }
    }
  },
})

/**
 * Batch upsert multiple sessions.
 * Used by session-watcher for efficient batch updates.
 */
export const batchUpsert = mutation({
  args: {
    sessions: v.array(v.object({
      id: v.string(),
      session_id: v.string(),
      name: v.string(),
      type: v.union(v.literal("main"), v.literal("chat"), v.literal("agent"), v.literal("cron")),
      status: v.union(v.literal("active"), v.literal("completed"), v.literal("stale")),
      model: v.string(),
      project_slug: v.optional(v.string()),
      task_id: v.optional(v.string()),
      tokens_input: v.optional(v.number()),
      tokens_output: v.optional(v.number()),
      tokens_cache_read: v.optional(v.number()),
      tokens_cache_write: v.optional(v.number()),
      tokens_total: v.optional(v.number()),
      cost_input: v.optional(v.number()),
      cost_output: v.optional(v.number()),
      cost_cache_read: v.optional(v.number()),
      cost_cache_write: v.optional(v.number()),
      cost_total: v.optional(v.number()),
      file_path: v.optional(v.string()),
      file_mtime_ms: v.optional(v.number()),
      created_at: v.number(),
      updated_at: v.number(),
      completed_at: v.optional(v.number()),
      last_activity_at: v.optional(v.number()),
      stop_reason: v.optional(v.string()),
      is_terminal_error: v.optional(v.boolean()),
      output_preview: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    let count = 0

    for (const sessionData of args.sessions) {
      // Check if session already exists
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_session_key", (q) => q.eq("id", sessionData.id))
        .unique()

      if (existing) {
        // Update existing session
        await ctx.db.patch(existing._id, {
          session_id: sessionData.session_id,
          name: sessionData.name,
          type: sessionData.type,
          status: sessionData.status,
          model: sessionData.model,
          project_slug: sessionData.project_slug,
          task_id: sessionData.task_id,
          tokens_input: sessionData.tokens_input,
          tokens_output: sessionData.tokens_output,
          tokens_cache_read: sessionData.tokens_cache_read,
          tokens_cache_write: sessionData.tokens_cache_write,
          tokens_total: sessionData.tokens_total,
          cost_input: sessionData.cost_input,
          cost_output: sessionData.cost_output,
          cost_cache_read: sessionData.cost_cache_read,
          cost_cache_write: sessionData.cost_cache_write,
          cost_total: sessionData.cost_total,
          file_path: sessionData.file_path,
          file_mtime_ms: sessionData.file_mtime_ms,
          updated_at: sessionData.updated_at,
          completed_at: sessionData.completed_at,
          last_activity_at: sessionData.last_activity_at,
          stop_reason: sessionData.stop_reason,
          is_terminal_error: sessionData.is_terminal_error,
          output_preview: sessionData.output_preview,
        })
      } else {
        // Create new session
        await ctx.db.insert("sessions", sessionData)
      }
      count++
    }

    return { count }
  },
})

/**
 * Delete a session by its session key.
 */
export const remove = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_key", (q) => q.eq("id", args.id))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
      return { success: true }
    }

    return { success: false }
  },
})

/**
 * Delete multiple sessions by their session keys.
 * Used by session-watcher to clean up removed sessions.
 */
export const batchRemove = mutation({
  args: {
    ids: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    let count = 0

    for (const id of args.ids) {
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_session_key", (q) => q.eq("id", id))
        .unique()

      if (existing) {
        await ctx.db.delete(existing._id)
        count++
      }
    }

    return { count }
  },
})

/**
 * Mark stale sessions based on file mtime threshold.
 * Called periodically by session-watcher or work loop.
 */
export const markStale = mutation({
  args: {
    threshold_ms: v.number(), // Sessions with mtime older than this are stale
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const now = Date.now()
    const cutoff = now - args.threshold_ms

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) =>
        q.eq("status", "active")
      )
      .collect()

    let count = 0

    for (const session of sessions) {
      // If no recent file activity, mark as stale
      if (!session.file_mtime_ms || session.file_mtime_ms < cutoff) {
        await ctx.db.patch(session._id, {
          status: "stale" as SessionStatus,
          updated_at: now,
        })
        count++
      }
    }

    return { count }
  },
})
