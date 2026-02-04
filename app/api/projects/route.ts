import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Project, ProjectInsert, Chat } from "@/lib/db/types"

// GET /api/projects — List all projects
export async function GET() {
  const projects = db.prepare(`
    SELECT 
      p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
    FROM projects p
    ORDER BY p.updated_at DESC
  `).all() as (Project & { task_count: number })[]

  return NextResponse.json({ projects })
}

// POST /api/projects — Create project
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  const { name, slug, description, color, repo_url, chat_layout, local_path, github_repo, work_loop_enabled, work_loop_schedule } = body
  
  if (!name || !slug) {
    return NextResponse.json(
      { error: "Name and slug are required" },
      { status: 400 }
    )
  }

  // Validate local_path if provided
  if (local_path && typeof local_path !== 'string') {
    return NextResponse.json(
      { error: "local_path must be a string" },
      { status: 400 }
    )
  }

  // Validate github_repo format if provided
  if (github_repo) {
    if (typeof github_repo !== 'string' || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(github_repo)) {
      return NextResponse.json(
        { error: "github_repo must be in owner/repo format" },
        { status: 400 }
      )
    }
  }

  // Validate work_loop_enabled if provided
  if (work_loop_enabled !== undefined && typeof work_loop_enabled !== 'boolean') {
    return NextResponse.json(
      { error: "work_loop_enabled must be a boolean" },
      { status: 400 }
    )
  }

  // Validate work_loop_schedule if provided
  if (work_loop_schedule) {
    if (typeof work_loop_schedule !== 'string') {
      return NextResponse.json(
        { error: "work_loop_schedule must be a string" },
        { status: 400 }
      )
    }
    // TODO: Add cron validation if needed
  }

  // Check slug uniqueness
  const existing = db.prepare(
    "SELECT id FROM projects WHERE slug = ?"
  ).get(slug)
  
  if (existing) {
    return NextResponse.json(
      { error: "A project with this slug already exists" },
      { status: 409 }
    )
  }

  const now = Date.now()
  const id = crypto.randomUUID()
  
  const project: Project = {
    id,
    slug,
    name,
    description: description || null,
    color: color || "#3b82f6",
    repo_url: repo_url || null,
    context_path: null,
    local_path: local_path || null,
    github_repo: github_repo || null,
    chat_layout: chat_layout || 'slack',
    work_loop_enabled: work_loop_enabled ? 1 : 0,
    work_loop_schedule: work_loop_schedule || '*/5 * * * *',
    created_at: now,
    updated_at: now,
  }

  db.prepare(`
    INSERT INTO projects (id, slug, name, description, color, repo_url, context_path, local_path, github_repo, chat_layout, work_loop_enabled, work_loop_schedule, created_at, updated_at)
    VALUES (@id, @slug, @name, @description, @color, @repo_url, @context_path, @local_path, @github_repo, @chat_layout, @work_loop_enabled, @work_loop_schedule, @created_at, @updated_at)
  `).run(project)

  // Create default "General" chat for the project
  const chatId = crypto.randomUUID()
  const chat: Chat = {
    id: chatId,
    project_id: id,
    title: "General",
    participants: JSON.stringify(["ada"]),
    session_key: null,
    created_at: now,
    updated_at: now,
  }
  
  db.prepare(`
    INSERT INTO chats (id, project_id, title, participants, session_key, created_at, updated_at)
    VALUES (@id, @project_id, @title, @participants, @session_key, @created_at, @updated_at)
  `).run(chat)

  return NextResponse.json({ project }, { status: 201 })
}
