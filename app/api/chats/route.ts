import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Chat, ChatMessage } from "@/lib/db/types"

// GET /api/chats?projectId=xxx — List chats for project
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get("projectId")
  
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    )
  }

  // Get chats with last message
  const chats = db.prepare(`
    SELECT 
      c.*,
      m.content as last_message_content,
      m.author as last_message_author,
      m.created_at as last_message_at
    FROM chats c
    LEFT JOIN (
      SELECT chat_id, content, author, created_at
      FROM chat_messages
      WHERE id IN (
        SELECT id FROM chat_messages cm2 
        WHERE cm2.chat_id = chat_messages.chat_id 
        ORDER BY created_at DESC LIMIT 1
      )
    ) m ON m.chat_id = c.id
    WHERE c.project_id = ?
    ORDER BY COALESCE(m.created_at, c.created_at) DESC
  `).all(projectId) as (Chat & { 
    last_message_content: string | null
    last_message_author: string | null
    last_message_at: number | null 
  })[]

  // Transform to include lastMessage object
  const result = chats.map(chat => ({
    ...chat,
    lastMessage: chat.last_message_content ? {
      content: chat.last_message_content,
      author: chat.last_message_author,
      created_at: chat.last_message_at,
    } : null,
  }))

  return NextResponse.json({ chats: result })
}

// POST /api/chats — Create new chat
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  const { project_id, title, participants = ["ada"] } = body
  
  if (!project_id || !title) {
    return NextResponse.json(
      { error: "project_id and title are required" },
      { status: 400 }
    )
  }

  // Verify project exists
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(project_id)
  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    )
  }

  const now = Date.now()
  const id = crypto.randomUUID()
  
  const chat: Chat = {
    id,
    project_id,
    title,
    participants: JSON.stringify(participants),
    created_at: now,
    updated_at: now,
  }

  db.prepare(`
    INSERT INTO chats (id, project_id, title, participants, created_at, updated_at)
    VALUES (@id, @project_id, @title, @participants, @created_at, @updated_at)
  `).run(chat)

  return NextResponse.json({ chat }, { status: 201 })
}
