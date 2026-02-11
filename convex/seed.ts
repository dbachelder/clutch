/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Seed mutations for data migration from SQLite.
 * These are simple insert-only mutations used by the migration script.
 * They accept all fields including the SQLite UUID `id`.
 */
import { mutation } from "./_generated/server"
import { v } from "convex/values"

export const insertProject = mutation({
  args: {
    id: v.string(),
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    repo_url: v.optional(v.string()),
    context_path: v.optional(v.string()),
    local_path: v.optional(v.string()),
    github_repo: v.optional(v.string()),
    chat_layout: v.union(v.literal("slack"), v.literal("imessage")),
    work_loop_enabled: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("projects", args)
  },
})

export const insertTask = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    priority: v.string(),
    role: v.optional(v.string()),
    assignee: v.optional(v.string()),
    requires_human_review: v.boolean(),
    tags: v.optional(v.string()),
    session_id: v.optional(v.string()),
    dispatch_status: v.optional(v.string()),
    dispatch_requested_at: v.optional(v.number()),
    dispatch_requested_by: v.optional(v.string()),
    position: v.number(),
    created_at: v.number(),
    updated_at: v.number(),
    completed_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", args as any)
  },
})

export const insertComment = mutation({
  args: {
    id: v.string(),
    task_id: v.string(),
    author: v.string(),
    author_type: v.string(),
    content: v.string(),
    type: v.string(),
    responded_at: v.optional(v.number()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("comments", args as any)
  },
})

export const insertChat = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    title: v.string(),
    participants: v.optional(v.string()),
    session_key: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chats", args)
  },
})

export const insertChatMessage = mutation({
  args: {
    id: v.string(),
    chat_id: v.string(),
    author: v.string(),
    content: v.string(),
    run_id: v.optional(v.string()),
    session_key: v.optional(v.string()),
    is_automated: v.optional(v.boolean()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", args)
  },
})

export const insertNotification = mutation({
  args: {
    id: v.string(),
    task_id: v.optional(v.string()),
    project_id: v.optional(v.string()),
    type: v.string(),
    severity: v.string(),
    title: v.string(),
    message: v.string(),
    agent: v.optional(v.string()),
    read: v.boolean(),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", args as any)
  },
})

export const insertEvent = mutation({
  args: {
    id: v.string(),
    project_id: v.optional(v.string()),
    task_id: v.optional(v.string()),
    type: v.string(),
    actor: v.string(),
    data: v.optional(v.string()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", args as any)
  },
})

export const insertSignal = mutation({
  args: {
    id: v.string(),
    task_id: v.string(),
    session_key: v.string(),
    agent_id: v.string(),
    kind: v.string(),
    severity: v.string(),
    message: v.string(),
    blocking: v.boolean(),
    responded_at: v.optional(v.number()),
    response: v.optional(v.string()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("signals", args as any)
  },
})

export const insertTaskDependency = mutation({
  args: {
    id: v.string(),
    task_id: v.string(),
    depends_on_id: v.string(),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("taskDependencies", args)
  },
})

// ============================================================================
// Work Loop Tables
// ============================================================================

export const insertWorkLoopRun = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    cycle: v.number(),
    phase: v.string(),
    action: v.string(),
    task_id: v.optional(v.string()),
    session_key: v.optional(v.string()),
    details: v.optional(v.string()),
    duration_ms: v.optional(v.number()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("workLoopRuns", args as any)
  },
})

export const insertWorkLoopState = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    status: v.string(),
    current_phase: v.optional(v.string()),
    current_cycle: v.number(),
    active_agents: v.number(),
    max_agents: v.number(),
    last_cycle_at: v.optional(v.number()),
    error_message: v.optional(v.string()),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("workLoopState", args as any)
  },
})

// ============================================================================
// Prompt & Analysis Tables
// ============================================================================

export const insertPromptVersion = mutation({
  args: {
    id: v.string(),
    role: v.string(),
    model: v.optional(v.string()),
    version: v.number(),
    content: v.string(),
    change_summary: v.optional(v.string()),
    parent_version_id: v.optional(v.string()),
    created_by: v.string(),
    active: v.boolean(),
    created_at: v.number(),
    ab_status: v.optional(v.string()),
    ab_split_percent: v.optional(v.number()),
    ab_started_at: v.optional(v.number()),
    ab_min_tasks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("promptVersions", args as any)
  },
})

export const insertTaskAnalysis = mutation({
  args: {
    id: v.string(),
    task_id: v.string(),
    session_key: v.optional(v.string()),
    role: v.string(),
    model: v.string(),
    prompt_version_id: v.string(),
    outcome: v.string(),
    token_count: v.optional(v.number()),
    duration_ms: v.optional(v.number()),
    failure_modes: v.optional(v.string()),
    amendments: v.optional(v.string()),
    amendment_status: v.optional(v.string()),
    amendment_resolved_at: v.optional(v.number()),
    amendment_reject_reason: v.optional(v.string()),
    analysis_summary: v.string(),
    confidence: v.number(),
    analyzed_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("taskAnalyses", args as any)
  },
})

export const insertPromptMetric = mutation({
  args: {
    id: v.string(),
    role: v.string(),
    model: v.string(),
    prompt_version_id: v.string(),
    period: v.string(),
    period_start: v.number(),
    total_tasks: v.number(),
    success_count: v.number(),
    failure_count: v.number(),
    partial_count: v.number(),
    abandoned_count: v.number(),
    avg_tokens: v.number(),
    avg_duration_ms: v.number(),
    bounce_count: v.number(),
    failure_modes: v.optional(v.string()),
    computed_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("promptMetrics", args as any)
  },
})

// ============================================================================
// Task Events & Model Pricing
// ============================================================================

export const insertTaskEvent = mutation({
  args: {
    id: v.string(),
    task_id: v.string(),
    project_id: v.string(),
    event_type: v.string(),
    timestamp: v.number(),
    actor: v.optional(v.string()),
    data: v.optional(v.string()),
    cost_input: v.optional(v.number()),
    cost_output: v.optional(v.number()),
    cost_total: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("task_events", args as any)
  },
})

export const insertModelPricing = mutation({
  args: {
    id: v.string(),
    model: v.string(),
    input_per_1m: v.number(),
    output_per_1m: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("model_pricing", args)
  },
})

// ============================================================================
// Feature & Requirements Tables
// ============================================================================

export const insertFeature = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    priority: v.string(),
    position: v.number(),
    created_at: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("features", args as any)
  },
})

export const insertRequirement = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    feature_id: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.string(),
    priority: v.string(),
    position: v.number(),
    created_at: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("requirements", args as any)
  },
})

export const insertRoadmapPhase = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    number: v.number(),
    name: v.string(),
    goal: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    depends_on: v.optional(v.string()),
    success_criteria: v.optional(v.string()),
    position: v.number(),
    inserted: v.optional(v.boolean()),
    created_at: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("roadmapPhases", args as any)
  },
})

export const insertPhaseRequirement = mutation({
  args: {
    id: v.string(),
    phase_id: v.string(),
    requirement_id: v.string(),
    project_id: v.string(),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("phaseRequirements", args)
  },
})

// ============================================================================
// Sessions & Feature Builder
// ============================================================================

export const insertSession = mutation({
  args: {
    id: v.string(),
    session_key: v.optional(v.string()),
    session_id: v.string(),
    session_type: v.string(),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: v.string(),
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
    last_active_at: v.optional(v.number()),
    output_preview: v.optional(v.string()),
    stop_reason: v.optional(v.string()),
    task_id: v.optional(v.string()),
    project_slug: v.optional(v.string()),
    file_path: v.optional(v.string()),
    created_at: v.optional(v.number()),
    updated_at: v.number(),
    completed_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", args as any)
  },
})

export const insertFeatureBuilderSession = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    user_id: v.optional(v.string()),
    status: v.string(),
    current_step: v.string(),
    completed_steps: v.array(v.string()),
    feature_data: v.optional(v.string()),
    result_task_id: v.optional(v.string()),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    last_activity_at: v.number(),
    duration_ms: v.optional(v.number()),
    steps_completed_count: v.number(),
    steps_skipped_count: v.optional(v.number()),
    research_used: v.boolean(),
    tasks_generated: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("featureBuilderSessions", args as any)
  },
})

export const insertFeatureBuilderAnalytics = mutation({
  args: {
    id: v.string(),
    project_id: v.string(),
    period: v.string(),
    period_start: v.number(),
    sessions_started: v.number(),
    sessions_completed: v.number(),
    sessions_cancelled: v.number(),
    avg_session_duration_ms: v.number(),
    avg_steps_completed: v.number(),
    features_created: v.number(),
    tasks_generated: v.number(),
    step_completion_rates: v.optional(v.string()),
    error_count: v.number(),
    updated_at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("featureBuilderAnalytics", args as any)
  },
})

// ============================================================================
// Clear All Mutation - for clean seeding
// ============================================================================

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete from all tables in dependency order (children before parents)
    const tables = [
      // Task-related (most dependent)
      "taskDependencies",
      "taskAnalyses",
      "task_events",
      "comments",
      "signals",
      // Session-related
      "sessions",
      "featureBuilderSessions",
      "featureBuilderAnalytics",
      // Chat-related
      "chatMessages",
      "chats",
      // Work loop
      "workLoopRuns",
      "workLoopState",
      // Feature/requirements
      "phaseRequirements",
      "requirements",
      "roadmapPhases",
      "features",
      // Prompt/analytics
      "promptMetrics",
      "promptVersions",
      // Model pricing
      "model_pricing",
      // Events/notifications
      "events",
      "notifications",
      // Core
      "tasks",
      "projects",
    ] as const

    for (const table of tables) {
      const records = await ctx.db.query(table).collect()
      for (const record of records) {
        await ctx.db.delete(record._id)
      }
    }

    return { deleted: tables.length }
  },
})
