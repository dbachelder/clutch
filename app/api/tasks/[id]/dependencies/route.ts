import { NextRequest, NextResponse } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tasks/[id]/dependencies — Get dependencies for a task
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const convex = getConvexClient()
    
    // Get the dependencies (tasks this task depends on)
    const dependencies = await convex.query(api.taskDependencies.getDependencies, { taskId: id })
    
    // Get the blocked by (tasks that depend on this task)
    const blockedBy = await convex.query(api.taskDependencies.getBlockedBy, { taskId: id })
    
    // Get incomplete dependencies
    const incomplete = await convex.query(api.taskDependencies.getIncomplete, { taskId: id })

    return NextResponse.json({
      task_id: id,
      dependencies,
      blocked_by: blockedBy,
      incomplete,
    })
  } catch (error) {
    console.error("[Task Dependencies API] Error fetching dependencies:", error)
    return NextResponse.json(
      { error: "Failed to fetch dependencies" },
      { status: 500 }
    )
  }
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

  try {
    const convex = getConvexClient()
    
    // Check for cycles before adding
    const wouldCycle = await convex.query(api.taskDependencies.wouldCreateCycle, {
      taskId: id,
      dependsOnId: depends_on_id,
    })
    
    if (wouldCycle) {
      return NextResponse.json(
        { error: "Adding this dependency would create a cycle" },
        { status: 400 }
      )
    }
    
    const dependency = await convex.mutation(api.taskDependencies.add, {
      taskId: id,
      dependsOnId: depends_on_id,
    })

    return NextResponse.json({ dependency }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add dependency"
    console.error("[Task Dependencies API] Error adding dependency:", error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/tasks/[id]/dependencies — Remove a dependency
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const depends_on_id = searchParams.get("depends_on_id")

  if (!depends_on_id) {
    return NextResponse.json(
      { error: "depends_on_id query parameter is required" },
      { status: 400 }
    )
  }

  try {
    const convex = getConvexClient()
    const success = await convex.mutation(api.taskDependencies.removeByRelationship, {
      taskId: id,
      dependsOnId: depends_on_id,
    })

    if (!success) {
      return NextResponse.json(
        { error: "Dependency not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Task Dependencies API] Error removing dependency:", error)
    return NextResponse.json(
      { error: "Failed to remove dependency" },
      { status: 500 }
    )
  }
}