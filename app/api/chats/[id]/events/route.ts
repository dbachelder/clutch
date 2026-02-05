import { NextRequest } from "next/server"
import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/chats/[id]/events — SSE stream for chat updates
// TODO: SSE endpoint needs special handling for Convex. Consider using:
// 1. Convex's built-in real-time subscriptions via useQuery hooks in the frontend
// 2. A polling-based approach
// 3. Keep this SSE endpoint using a hybrid approach with Convex queries
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  try {
    const convex = getConvexClient()
    
    // Verify chat exists
    const chat = await convex.query(api.chats.getById, { id })
    if (!chat) {
      return new Response("Chat not found", { status: 404 })
    }

    // TODO: Implement SSE with Convex
    // For now, return a simple response indicating the client should use
    // Convex's real-time subscriptions instead
    return new Response(
      JSON.stringify({ 
        message: "SSE not yet implemented with Convex. Use Convex useQuery hooks for real-time updates." 
      }), 
      { 
        status: 501,
        headers: { "Content-Type": "application/json" }
      }
    )

    /*
    // Original SSE implementation - needs to be adapted for Convex
    let pingInterval: NodeJS.Timeout | null = null
    let activeController: ReadableStreamDefaultController | null = null

    const stream = new ReadableStream({
      start(controller) {
        activeController = controller
        
        // Add to global connections registry
        addConnection(id, controller)
        
        // Send initial connection event
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`event: connected\ndata: {"chatId":"${id}"}\n\n`))
        
        // Keep-alive ping every 15 seconds
        pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`:ping\n\n`))
          } catch {
            // Connection closed
            if (pingInterval) clearInterval(pingInterval)
          }
        }, 15000)
        
        // Cleanup on close
        request.signal.addEventListener("abort", () => {
          if (pingInterval) clearInterval(pingInterval)
          if (activeController) removeConnection(id, activeController)
        })
      },
      cancel() {
        if (pingInterval) clearInterval(pingInterval)
        if (activeController) removeConnection(id, activeController)
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    })
    */
  } catch (error) {
    console.error("[Events API] Error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}
