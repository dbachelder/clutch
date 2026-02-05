import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  projects: defineTable({
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
  })
    .index('by_slug', ['slug'])
    .index('by_name', ['name']),

  tasks: defineTable({
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
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent')
    ),
    assignee: v.optional(v.string()),
    requires_human_review: v.boolean(),
    tags: v.optional(v.array(v.string())),
    session_id: v.optional(v.string()),
    dispatch_status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('spawning'),
        v.literal('active'),
        v.literal('completed'),
        v.literal('failed')
      )
    ),
    dispatch_requested_at: v.optional(v.number()),
    dispatch_requested_by: v.optional(v.string()),
    position: v.number(),
    completed_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_project', ['project_id'])
    .index('by_status', ['status'])
    .index('by_project_status', ['project_id', 'status'])
    .index('by_assignee', ['assignee'])
    .index('by_project_position', ['project_id', 'status', 'position']),
})
