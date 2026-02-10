import { NextRequest, NextResponse } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

// GET /api/chats/messages/stuck — Get messages stuck in transitional delivery states
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500)
  
  try {
    const convex = getConvexClient()

    // Get messages stuck in "sent" or "delivered" states
    const [sentMessages, deliveredMessages] = await Promise.all([
      convex.query(api.chats.getMessagesByDeliveryStatus, {
        delivery_status: "sent",
        limit: Math.floor(limit / 2),
      }),
      convex.query(api.chats.getMessagesByDeliveryStatus, {
        delivery_status: "delivered", 
        limit: Math.floor(limit / 2),
      })
    ])

    // Combine and sort by creation time (oldest first)
    const allMessages = [...sentMessages, ...deliveredMessages]
      .sort((a, b) => a.created_at - b.created_at)

    // Only return human messages (author !== "ada") as these are the ones that should progress
    const humanMessages = allMessages.filter(msg => msg.author !== "ada")

    return NextResponse.json({ 
      messages: humanMessages,
      total: humanMessages.length
    })
  } catch (error) {
    console.error("[Stuck Messages API] Error fetching stuck messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch stuck messages" },
      { status: 500 }
    )
  }
}