import { NextRequest } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/chats/[id]/events — SSE stream for chat updates
// Real-time updates are handled by Convex useQuery hooks on the frontend.
// This endpoint exists as a no-op keep-alive to prevent client-side errors
// from the legacy EventSource connection.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const convex = getConvexClient()

    // Verify chat exists
    const chat = await convex.query(api.chats.getById, { id })
    if (!chat) {
      return new Response("Chat not found", { status: 404 })
    }

    // Return a minimal SSE stream that just pings to keep the connection alive.
    // Convex subscriptions handle the actual real-time data on the frontend.
    let pingInterval: NodeJS.Timeout | null = null

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`event: connected\ndata: {"chatId":"${id}","mode":"convex"}\n\n`))

        pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`:ping\n\n`))
          } catch {
            if (pingInterval) clearInterval(pingInterval)
          }
        }, 30000)

        request.signal.addEventListener("abort", () => {
          if (pingInterval) clearInterval(pingInterval)
        })
      },
      cancel() {
        if (pingInterval) clearInterval(pingInterval)
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    console.error("[Events API] Error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}
