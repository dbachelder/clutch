import { NextRequest, NextResponse } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

type RouteParams = { params: Promise<{ id: string; depId: string }> }

// DELETE /api/tasks/[id]/dependencies/[depId] — Remove a dependency
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, depId } = await params

  try {
    const convex = getConvexClient()

    // Verify task exists
    const taskResult = await convex.query(api.tasks.getById, { id })
    if (!taskResult) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // TODO: needs Convex function - deleteDependency mutation
    // For now, return error indicating not implemented
    return NextResponse.json(
      { error: "Removing dependencies not yet implemented in Convex" },
      { status: 501 }
    )

    // When implemented:
    // 1. Verify the dependency exists and belongs to this task
    // 2. Delete the dependency link using depId
  } catch (error) {
    console.error("[Dependencies API] Error removing dependency:", error)
    return NextResponse.json(
      { error: "Failed to remove dependency" },
      { status: 500 }
    )
  }
}
