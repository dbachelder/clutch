import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDependencyById, removeDependency } from "@/lib/db/dependencies"

type RouteParams = { params: Promise<{ id: string; depId: string }> }

// DELETE /api/tasks/[id]/dependencies/[depId] — Remove a dependency
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, depId } = await params

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id)
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  // Verify the dependency exists and belongs to this task
  const dependency = getDependencyById(depId)
  if (!dependency) {
    return NextResponse.json(
      { error: "Dependency not found" },
      { status: 404 }
    )
  }

  // Ensure the dependency belongs to the specified task
  if (dependency.task_id !== id) {
    return NextResponse.json(
      { error: "Dependency does not belong to this task" },
      { status: 403 }
    )
  }

  const deleted = removeDependency(depId)

  if (!deleted) {
    return NextResponse.json(
      { error: "Failed to remove dependency" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
