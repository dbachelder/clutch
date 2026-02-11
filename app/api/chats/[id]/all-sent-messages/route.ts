import { NextRequest, NextResponse } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/chats/[id]/all-sent-messages — Get ALL messages with "sent" status (for batch delivery marking)
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

    // Get ALL messages with "sent" status
    const messages = await convex.query(api.chats.getAllSentMessages, {
      chat_id: id,
    })

    return NextResponse.json({
      messages: messages,
      chat_id: id
    })
  } catch (error) {
    console.error("[All Sent Messages API] Error fetching messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch sent messages" },
      { status: 500 }
    )
  }
}
