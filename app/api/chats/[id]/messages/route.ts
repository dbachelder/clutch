import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { ChatMessage } from "@/lib/db/types"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/chats/[id]/messages — Get messages (paginated)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const before = searchParams.get("before") // Message ID to paginate before
  
  // Verify chat exists
  const chat = db.prepare("SELECT id FROM chats WHERE id = ?").get(id)
  if (!chat) {
    return NextResponse.json(
      { error: "Chat not found" },
      { status: 404 }
    )
  }

  let query = `
    SELECT * FROM chat_messages 
    WHERE chat_id = ?
  `
  const queryParams: (string | number)[] = [id]
  
  if (before) {
    // Get the created_at of the 'before' message for cursor pagination
    const beforeMsg = db.prepare(
      "SELECT created_at FROM chat_messages WHERE id = ?"
    ).get(before) as { created_at: number } | undefined
    
    if (beforeMsg) {
      query += " AND created_at < ?"
      queryParams.push(beforeMsg.created_at)
    }
  }
  
  query += " ORDER BY created_at DESC LIMIT ?"
  queryParams.push(limit)
  
  const messages = db.prepare(query).all(...queryParams) as ChatMessage[]
  
  // Reverse to chronological order
  messages.reverse()
  
  // Check if there are more messages
  const hasMore = messages.length === limit

  return NextResponse.json({ 
    messages, 
    hasMore,
    cursor: messages.length > 0 ? messages[0].id : null,
  })
}

// POST /api/chats/[id]/messages — Send message
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json()
  
  const { content, author = "dan" } = body
  
  if (!content) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    )
  }

  // Verify chat exists
  const chat = db.prepare("SELECT id FROM chats WHERE id = ?").get(id)
  if (!chat) {
    return NextResponse.json(
      { error: "Chat not found" },
      { status: 404 }
    )
  }

  const now = Date.now()
  const messageId = crypto.randomUUID()
  
  const message: ChatMessage = {
    id: messageId,
    chat_id: id,
    author,
    content,
    created_at: now,
  }

  db.prepare(`
    INSERT INTO chat_messages (id, chat_id, author, content, created_at)
    VALUES (@id, @chat_id, @author, @content, @created_at)
  `).run(message)

  // Update chat's updated_at
  db.prepare("UPDATE chats SET updated_at = ? WHERE id = ?").run(now, id)

  return NextResponse.json({ message }, { status: 201 })
}
