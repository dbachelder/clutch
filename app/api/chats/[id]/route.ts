import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Chat, ChatMessage } from "@/lib/db/types"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/chats/[id] — Get chat with recent messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  const chat = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as Chat | undefined

  if (!chat) {
    return NextResponse.json(
      { error: "Chat not found" },
      { status: 404 }
    )
  }

  // Get recent messages (last 50)
  const messages = db.prepare(`
    SELECT * FROM chat_messages 
    WHERE chat_id = ? 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all(id) as ChatMessage[]

  // Reverse to get chronological order
  messages.reverse()

  return NextResponse.json({ chat, messages })
}

// PATCH /api/chats/[id] — Update chat
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json()
  
  const existing = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as Chat | undefined
  
  if (!existing) {
    return NextResponse.json(
      { error: "Chat not found" },
      { status: 404 }
    )
  }

  const { title, participants } = body
  
  const updated: Chat = {
    ...existing,
    title: title ?? existing.title,
    participants: participants ? JSON.stringify(participants) : existing.participants,
    updated_at: Date.now(),
  }

  db.prepare(`
    UPDATE chats 
    SET title = @title, participants = @participants, updated_at = @updated_at
    WHERE id = @id
  `).run(updated)

  return NextResponse.json({ chat: updated })
}

// DELETE /api/chats/[id] — Delete chat
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  const existing = db.prepare("SELECT id FROM chats WHERE id = ?").get(id)
  
  if (!existing) {
    return NextResponse.json(
      { error: "Chat not found" },
      { status: 404 }
    )
  }

  db.prepare("DELETE FROM chats WHERE id = ?").run(id)

  return NextResponse.json({ success: true })
}
