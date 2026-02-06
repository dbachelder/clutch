import { NextRequest, NextResponse } from "next/server"
import { getOpenClawClient, initializeOpenClawClient } from "@/lib/openclaw/client"

/**
 * POST /api/openclaw/rpc
 *
 * Proxy browser RPC calls to the OpenClaw gateway via the persistent
 * server-side WebSocket client.  The gateway only speaks WS for RPC —
 * there is no HTTP /rpc endpoint — so we bridge through the WS client.
 */

/** Ensure the WS client is connected (lazy init). */
function ensureClient() {
  const client = getOpenClawClient()
  if (client.getStatus() === "disconnected") {
    initializeOpenClawClient()
  }
  return client
}

export async function POST(request: NextRequest) {
  let body: { id?: string; method?: string; params?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { type: "res", id: "unknown", ok: false, error: { message: "Invalid JSON body" } },
      { status: 400 },
    )
  }

  const { id = "unknown", method, params } = body
  if (!method) {
    return NextResponse.json(
      { type: "res", id, ok: false, error: { message: "Missing 'method' in request body" } },
      { status: 400 },
    )
  }

  const client = ensureClient()

  // If the WS client isn't connected yet, give it a brief window to connect.
  if (client.getStatus() !== "connected") {
    await new Promise((r) => setTimeout(r, 2000))
  }

  if (client.getStatus() !== "connected") {
    return NextResponse.json(
      { type: "res", id, ok: false, error: { message: "OpenClaw gateway not connected" } },
      { status: 502 },
    )
  }

  try {
    const payload = await client.rpc(method, params)
    return NextResponse.json({ type: "res", id, ok: true, payload })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { type: "res", id, ok: false, error: { message } },
      { status: 502 },
    )
  }
}
