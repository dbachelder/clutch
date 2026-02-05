import { NextRequest, NextResponse } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

// POST /api/signal/[id]/respond — Respond to signal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  
  const { response } = body
  
  if (!response || typeof response !== "string") {
    return NextResponse.json(
      { error: "response is required and must be a string" },
      { status: 400 }
    )
  }
  
  try {
    const convex = getConvexClient()

    const signal = await convex.mutation(api.signals.respond, {
      id,
      response,
    })

    // TODO: Integrate with OpenClaw sessions_send to notify the agent
    // This will be wired later when OpenClaw session integration is ready
    
    return NextResponse.json({
      success: true,
      signal,
      // TODO: Add session notification status once OpenClaw integration is ready
    })
  } catch (error) {
    console.error("[Signal API] Error responding to signal:", error)
    const message = error instanceof Error ? error.message : "Failed to respond to signal"
    
    if (message.includes("not found")) {
      return NextResponse.json(
        { error: "Signal not found" },
        { status: 404 }
      )
    }
    
    if (message.includes("already been responded")) {
      return NextResponse.json(
        { error: "Signal has already been responded to" },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
