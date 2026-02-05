import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Comment, CommentType, AuthorType } from "@/lib/db/types"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tasks/[id]/comments — List comments for task
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id)
  if (!task) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    )
  }

  const comments = db.prepare(`
    SELECT * FROM comments 
    WHERE task_id = ? 
    ORDER BY created_at ASC
  `).all(id) as Comment[]

  return NextResponse.json({ comments })
}

// POST /api/tasks/[id]/comments — Add comment
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json()
  
  const { 
    content, 
    author = "dan",
    author_type = "human",
    type = "message",
  } = body
  
  if (!content) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    )
  }

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id)
  if (!task) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    )
  }

  const now = Date.now()
  const commentId = crypto.randomUUID()
  
  const comment: Comment = {
    id: commentId,
    task_id: id,
    author,
    author_type: author_type as AuthorType,
    content,
    type: type as CommentType,
    responded_at: null,
    created_at: now,
  }

  db.prepare(`
    INSERT INTO comments (id, task_id, author, author_type, content, type, responded_at, created_at)
    VALUES (@id, @task_id, @author, @author_type, @content, @type, @responded_at, @created_at)
  `).run(comment)

  return NextResponse.json({ comment }, { status: 201 })
}
