import { mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Migration mutations for SQLite → Convex data migration
 * These mutations accept full data including IDs and timestamps for idempotent migration
 */

// ============================================
// Projects
// ============================================

export const createProject = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    repo_url: v.optional(v.string()),
    context_path: v.optional(v.string()),
    local_path: v.optional(v.string()),
    github_repo: v.optional(v.string()),
    chat_layout: v.union(v.literal('slack'), v.literal('imessage')),
    work_loop_enabled: v.boolean(),
    work_loop_schedule: v.string(),
    created_at: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if project with this slug already exists
    const existing = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()

    if (existing) {
      return { _id: existing._id, skipped: true }
    }

    const projectId = await ctx.db.insert('projects', args)
    return { _id: projectId, skipped: false }
  },
})

// ============================================
// Tasks
// ============================================

export const createTask = mutation({
  args: {
    project_id: v.id('projects'),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('backlog'),
      v.literal('ready'),
      v.literal('in_progress'),
      v.literal('review'),
      v.literal('done')
    ),
    priority: v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    role: v.optional(v.union(v.literal('any'), v.literal('pm'), v.literal('dev'), v.literal('qa'), v.literal('research'), v.literal('security'))),
    assignee: v.optional(v.string()),
    requires_human_review: v.boolean(),
    tags: v.optional(v.array(v.string())),
    session_id: v.optional(v.string()),
    dispatch_status: v.optional(v.union(v.literal('pending'), v.literal('spawning'), v.literal('active'), v.literal('completed'), v.literal('failed'))),
    dispatch_requested_at: v.optional(v.number()),
    dispatch_requested_by: v.optional(v.string()),
    position: v.number(),
    created_at: v.number(),
    updated_at: v.number(),
    completed_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // For idempotency, check if a task with same project_id, title, and created_at exists
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('project_id', args.project_id))
      .collect()

    const duplicate = existing.find(
      (t) => t.title === args.title && t.created_at === args.created_at
    )

    if (duplicate) {
      return { _id: duplicate._id, skipped: true }
    }

    const taskId = await ctx.db.insert('tasks', args)
    return { _id: taskId, skipped: false }
  },
})

// ============================================
// Comments
// ============================================

export const createComment = mutation({
  args: {
    task_id: v.id('tasks'),
    author: v.string(),
    author_type: v.union(v.literal('coordinator'), v.literal('agent'), v.literal('human')),
    content: v.string(),
    type: v.union(v.literal('message'), v.literal('status_change'), v.literal('request_input'), v.literal('completion')),
    responded_at: v.optional(v.number()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by task_id + created_at
    const existing = await ctx.db
      .query('comments')
      .withIndex('by_task', (q) => q.eq('task_id', args.task_id))
      .collect()

    const duplicate = existing.find((c) => c.created_at === args.created_at)

    if (duplicate) {
      return { _id: duplicate._id, skipped: true }
    }

    const commentId = await ctx.db.insert('comments', args)
    return { _id: commentId, skipped: false }
  },
})

// ============================================
// Chats
// ============================================

export const createChat = mutation({
  args: {
    project_id: v.id('projects'),
    title: v.string(),
    participants: v.optional(v.array(v.string())),
    session_key: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by project_id + title
    const existing = await ctx.db
      .query('chats')
      .withIndex('by_project', (q) => q.eq('project_id', args.project_id))
      .collect()

    const duplicate = existing.find((c) => c.title === args.title)

    if (duplicate) {
      return { _id: duplicate._id, skipped: true }
    }

    const chatId = await ctx.db.insert('chats', args)
    return { _id: chatId, skipped: false }
  },
})

// ============================================
// Chat Messages
// ============================================

export const createChatMessage = mutation({
  args: {
    chat_id: v.id('chats'),
    author: v.string(),
    content: v.string(),
    run_id: v.optional(v.string()),
    session_key: v.optional(v.string()),
    is_automated: v.optional(v.boolean()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by chat_id + created_at
    const existing = await ctx.db
      .query('chatMessages')
      .withIndex('by_chat', (q) => q.eq('chat_id', args.chat_id))
      .collect()

    const duplicate = existing.find((m) => m.created_at === args.created_at)

    if (duplicate) {
      return { _id: duplicate._id, skipped: true }
    }

    const messageId = await ctx.db.insert('chatMessages', args)
    return { _id: messageId, skipped: false }
  },
})

// ============================================
// Notifications
// ============================================

export const createNotification = mutation({
  args: {
    task_id: v.optional(v.id('tasks')),
    project_id: v.optional(v.id('projects')),
    type: v.union(v.literal('escalation'), v.literal('request_input'), v.literal('completion'), v.literal('system')),
    severity: v.union(v.literal('info'), v.literal('warning'), v.literal('critical')),
    title: v.string(),
    message: v.string(),
    agent: v.optional(v.string()),
    read: v.boolean(),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by created_at (rough dedup)
    const existing = await ctx.db
      .query('notifications')
      .withIndex('by_created', (q) => q.eq('created_at', args.created_at))
      .unique()

    if (existing) {
      return { _id: existing._id, skipped: true }
    }

    const notificationId = await ctx.db.insert('notifications', args)
    return { _id: notificationId, skipped: false }
  },
})

// ============================================
// Events
// ============================================

export const createEvent = mutation({
  args: {
    project_id: v.optional(v.id('projects')),
    task_id: v.optional(v.id('tasks')),
    type: v.union(
      v.literal('task_created'),
      v.literal('task_moved'),
      v.literal('task_assigned'),
      v.literal('task_completed'),
      v.literal('comment_added'),
      v.literal('agent_started'),
      v.literal('agent_completed'),
      v.literal('chat_created'),
      v.literal('message_sent')
    ),
    actor: v.string(),
    data: v.optional(v.string()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by created_at
    const existing = await ctx.db
      .query('events')
      .withIndex('by_created', (q) => q.eq('created_at', args.created_at))
      .unique()

    if (existing) {
      return { _id: existing._id, skipped: true }
    }

    const eventId = await ctx.db.insert('events', args)
    return { _id: eventId, skipped: false }
  },
})

// ============================================
// Signals
// ============================================

export const createSignal = mutation({
  args: {
    task_id: v.id('tasks'),
    session_key: v.string(),
    agent_id: v.string(),
    kind: v.union(v.literal('question'), v.literal('blocker'), v.literal('alert'), v.literal('fyi')),
    severity: v.union(v.literal('normal'), v.literal('high'), v.literal('critical')),
    message: v.string(),
    blocking: v.boolean(),
    responded_at: v.optional(v.number()),
    response: v.optional(v.string()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by task_id + created_at
    const existing = await ctx.db
      .query('signals')
      .withIndex('by_task', (q) => q.eq('task_id', args.task_id))
      .collect()

    const duplicate = existing.find((s) => s.created_at === args.created_at)

    if (duplicate) {
      return { _id: duplicate._id, skipped: true }
    }

    const signalId = await ctx.db.insert('signals', args)
    return { _id: signalId, skipped: false }
  },
})

// ============================================
// Task Dependencies
// ============================================

export const createTaskDependency = mutation({
  args: {
    task_id: v.id('tasks'),
    depends_on_id: v.id('tasks'),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by task_id + depends_on_id
    const existing = await ctx.db
      .query('taskDependencies')
      .withIndex('by_task_depends_on', (q) =>
        (q as unknown as { eq: (field: string, value: unknown) => typeof q }).eq('task_id', args.task_id)
      )
      .collect()

    const duplicate = existing.find((d) => d.depends_on_id === args.depends_on_id)

    if (duplicate) {
      return { _id: duplicate._id, skipped: true }
    }

    const depId = await ctx.db.insert('taskDependencies', args)
    return { _id: depId, skipped: false }
  },
})
