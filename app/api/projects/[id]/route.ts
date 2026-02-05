import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Project } from "@/lib/db/types"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/projects/[id] — Get project by ID or slug
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  const project = db.prepare(`
    SELECT 
      p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
    FROM projects p
    WHERE p.id = ? OR p.slug = ?
  `).get(id, id) as (Project & { task_count: number }) | undefined

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({ project })
}

// PATCH /api/projects/[id] — Update project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json()
  
  const existing = db.prepare(
    "SELECT * FROM projects WHERE id = ? OR slug = ?"
  ).get(id, id) as Project | undefined
  
  if (!existing) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    )
  }

  const { name, slug, description, color, repo_url, context_path, chat_layout, local_path, github_repo, work_loop_enabled, work_loop_schedule } = body
  
  // Validate local_path if provided
  if (local_path !== undefined && local_path !== null && typeof local_path !== 'string') {
    return NextResponse.json(
      { error: "local_path must be a string" },
      { status: 400 }
    )
  }

  // Validate github_repo format if provided
  if (github_repo !== undefined && github_repo !== null) {
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
  if (work_loop_schedule !== undefined && work_loop_schedule !== null) {
    if (typeof work_loop_schedule !== 'string') {
      return NextResponse.json(
        { error: "work_loop_schedule must be a string" },
        { status: 400 }
      )
    }
    // TODO: Add cron validation if needed
  }
  
  // If changing slug, check uniqueness
  if (slug && slug !== existing.slug) {
    const slugExists = db.prepare(
      "SELECT id FROM projects WHERE slug = ? AND id != ?"
    ).get(slug, existing.id)
    
    if (slugExists) {
      return NextResponse.json(
        { error: "A project with this slug already exists" },
        { status: 409 }
      )
    }
  }

  const updated: Project = {
    ...existing,
    name: name ?? existing.name,
    slug: slug ?? existing.slug,
    description: description !== undefined ? description : existing.description,
    color: color ?? existing.color,
    repo_url: repo_url !== undefined ? repo_url : existing.repo_url,
    context_path: context_path !== undefined ? context_path : existing.context_path,
    local_path: local_path !== undefined ? local_path : existing.local_path,
    github_repo: github_repo !== undefined ? github_repo : existing.github_repo,
    chat_layout: chat_layout ?? existing.chat_layout,
    work_loop_enabled: work_loop_enabled !== undefined ? (work_loop_enabled ? 1 : 0) : existing.work_loop_enabled,
    work_loop_schedule: work_loop_schedule !== undefined ? work_loop_schedule : existing.work_loop_schedule,
    updated_at: Date.now(),
  }

  db.prepare(`
    UPDATE projects 
    SET name = @name, slug = @slug, description = @description, 
        color = @color, repo_url = @repo_url, context_path = @context_path,
        local_path = @local_path, github_repo = @github_repo,
        chat_layout = @chat_layout, work_loop_enabled = @work_loop_enabled,
        work_loop_schedule = @work_loop_schedule, updated_at = @updated_at
    WHERE id = @id
  `).run(updated)

  return NextResponse.json({ project: updated })
}

// DELETE /api/projects/[id] — Delete project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  const existing = db.prepare(
    "SELECT id FROM projects WHERE id = ? OR slug = ?"
  ).get(id, id)
  
  if (!existing) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    )
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run((existing as { id: string }).id)

  return NextResponse.json({ success: true })
}
