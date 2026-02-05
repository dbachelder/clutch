import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  getTaskDependencies,
  getTasksBlockedBy,
  addDependency,
  dependencyExists,
  wouldCreateCycle,
} from "@/lib/db/dependencies"
import type { Task } from "@/lib/db/types"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tasks/[id]/dependencies — Get task dependencies
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id)
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const dependsOn = getTaskDependencies(id)
  const blocks = getTasksBlockedBy(id)

  return NextResponse.json({
    depends_on: dependsOn,
    blocks: blocks,
  })
}

// POST /api/tasks/[id]/dependencies — Add a dependency
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json()

  const { depends_on_id } = body

  if (!depends_on_id) {
    return NextResponse.json(
      { error: "depends_on_id is required" },
      { status: 400 }
    )
  }

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id) as Task | undefined
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  // Verify the dependency task exists
  const dependsOnTask = db.prepare("SELECT id FROM tasks WHERE id = ?").get(depends_on_id) as Task | undefined
  if (!dependsOnTask) {
    return NextResponse.json(
      { error: "Dependency task not found" },
      { status: 404 }
    )
  }

  // Check for self-dependency
  if (id === depends_on_id) {
    return NextResponse.json(
      { error: "Task cannot depend on itself" },
      { status: 400 }
    )
  }

  // Check if dependency already exists
  if (dependencyExists(id, depends_on_id)) {
    return NextResponse.json(
      { error: "Dependency already exists" },
      { status: 400 }
    )
  }

  // Check for circular dependency
  if (wouldCreateCycle(id, depends_on_id)) {
    return NextResponse.json(
      { error: "Adding this dependency would create a circular dependency" },
      { status: 400 }
    )
  }

  const dependency = addDependency(id, depends_on_id)

  return NextResponse.json({ dependency }, { status: 201 })
}
