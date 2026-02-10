import { NextRequest, NextResponse } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/chats/[id]/latest-human-message — Get the most recent human message in a chat
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  try {
    const convex = getConvexClient()

    // Verify chat exists
    const chat = await convex.query(api.chats.getById, { id })
    if (!chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      )
    }

    // Get the latest human message (non-ada message)
    const message = await convex.query(api.chats.getLatestHumanMessage, {
      chat_id: id,
    })

    return NextResponse.json({ 
      message: message,
      chat_id: id 
    })
  } catch (error) {
    console.error("[Latest Human Message API] Error fetching message:", error)
    return NextResponse.json(
      { error: "Failed to fetch latest human message" },
      { status: 500 }
    )
  }
}