import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/openclaw/rpc
 * Proxy RPC calls to OpenClaw gateway (avoids CORS from browser)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const openclawUrl = process.env.OPENCLAW_HTTP_URL || "http://127.0.0.1:18789"
    const openclawToken = process.env.OPENCLAW_TOKEN || process.env.NEXT_PUBLIC_OPENCLAW_TOKEN || ""

    const response = await fetch(`${openclawUrl}/rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openclawToken ? { Authorization: `Bearer ${openclawToken}` } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return NextResponse.json(
        { type: "res", id: body.id, ok: false, error: { message: `OpenClaw HTTP ${response.status}: ${response.statusText}` } },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { type: "res", id: "unknown", ok: false, error: { message: `Proxy error: ${message}` } },
      { status: 502 }
    )
  }
}
