import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Task, Comment } from "@/lib/db/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST /api/tasks/:id/complete — Mark task as complete
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  const body = await request.json()
  
  const { summary, prUrl, notes, agent } = body
  
  if (!summary) {
    return NextResponse.json(
      { error: "Summary is required" },
      { status: 400 }
    )
  }
  
  // Get task
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }
  
  const now = Date.now()
  
  // Determine new status - 'review' if PR created, 'done' otherwise
  const newStatus = prUrl ? "review" : "done"
  
  // Build completion comment content
  let commentContent = `## Task Completed\n\n${summary}`
  if (prUrl) {
    commentContent += `\n\n**Pull Request**: ${prUrl}`
  }
  if (notes) {
    commentContent += `\n\n**Notes**: ${notes}`
  }
  
  // Create completion comment
  const commentId = crypto.randomUUID()
  const comment: Comment = {
    id: commentId,
    task_id: id,
    author: agent || task.assignee || "agent",
    author_type: "agent",
    content: commentContent,
    type: "completion",
    responded_at: null,
    created_at: now,
  }
  
  db.prepare(`
    INSERT INTO comments (id, task_id, author, author_type, content, type, responded_at, created_at)
    VALUES (@id, @task_id, @author, @author_type, @content, @type, @responded_at, @created_at)
  `).run(comment)
  
  // Update task status
  db.prepare(`
    UPDATE tasks 
    SET 
      status = ?,
      dispatch_status = 'completed',
      completed_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(newStatus, now, now, id)
  
  // Log event
  db.prepare(`
    INSERT INTO events (id, project_id, task_id, type, actor, data, created_at)
    VALUES (?, ?, ?, 'task_completed', ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    task.project_id,
    task.id,
    agent || task.assignee || "agent",
    JSON.stringify({ summary, prUrl, notes, newStatus }),
    now
  )
  
  return NextResponse.json({
    success: true,
    task: {
      id: task.id,
      status: newStatus,
      completed_at: now,
    },
    comment: {
      id: commentId,
      type: "completion",
    },
  })
}
