import { NextRequest, NextResponse } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tasks/[id]/dependencies — Get task dependencies
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const convex = getConvexClient()

    // Use getWithDependencies to get task with dependencies info
    const result = await convex.query(api.tasks.getWithDependencies, { id })

    if (!result) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({
      depends_on: result.dependencies,
      blocks: result.blockedBy,
    })
  } catch (error) {
    console.error("[Dependencies API] Error fetching dependencies:", error)
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

  // Check for self-dependency
  if (id === depends_on_id) {
    return NextResponse.json(
      { error: "Task cannot depend on itself" },
      { status: 400 }
    )
  }

  try {
    const convex = getConvexClient()

    // Verify task exists
    const taskResult = await convex.query(api.tasks.getById, { id })
    if (!taskResult) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Verify the dependency task exists
    const depResult = await convex.query(api.tasks.getById, { id: depends_on_id })
    if (!depResult) {
      return NextResponse.json(
        { error: "Dependency task not found" },
        { status: 404 }
      )
    }

    // TODO: needs Convex function - addDependency mutation
    // For now, return error indicating not implemented
    return NextResponse.json(
      { error: "Adding dependencies not yet implemented in Convex" },
      { status: 501 }
    )

    // When implemented, the mutation should:
    // 1. Check if dependency already exists
    // 2. Check for circular dependency
    // 3. Create the dependency link
  } catch (error) {
    console.error("[Dependencies API] Error adding dependency:", error)
    return NextResponse.json(
      { error: "Failed to add dependency" },
      { status: 500 }
    )
  }
}
