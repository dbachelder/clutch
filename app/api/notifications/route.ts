import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Task } from "@/lib/db/types"

export type NotificationSeverity = "info" | "warning" | "critical"

interface Notification {
  id: string
  task_id: string | null
  project_id: string | null
  type: "escalation" | "request_input" | "completion" | "system"
  severity: NotificationSeverity
  title: string
  message: string
  agent: string | null
  read: number  // SQLite boolean (0/1)
  created_at: number
}

// GET /api/notifications — List notifications
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get("unread") === "true"
  const limit = parseInt(searchParams.get("limit") || "50")
  
  let query = `
    SELECT * FROM notifications 
    ${unreadOnly ? "WHERE read = 0" : ""}
    ORDER BY 
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
      END,
      created_at DESC
    LIMIT ?
  `
  
  const notifications = db.prepare(query).all(limit) as Notification[]
  
  return NextResponse.json({
    notifications,
    unreadCount: db.prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0").get() as { count: number },
  })
}

// POST /api/notifications — Create notification (escalation, request_input, etc.)
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  const { 
    taskId, 
    projectId,
    type = "escalation",
    severity = "info",
    title,
    message,
    agent,
  } = body
  
  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    )
  }
  
  // Resolve project_id from task if not provided
  let resolvedProjectId = projectId
  if (!resolvedProjectId && taskId) {
    const task = db.prepare("SELECT project_id FROM tasks WHERE id = ?").get(taskId) as Task | undefined
    resolvedProjectId = task?.project_id
  }
  
  const now = Date.now()
  const id = crypto.randomUUID()
  
  // Generate title if not provided
  const notificationTitle = title || (() => {
    switch (type) {
      case "escalation": return `🚨 ${severity === "critical" ? "CRITICAL: " : ""}Escalation`
      case "request_input": return "❓ Input Requested"
      case "completion": return "✅ Task Completed"
      default: return "📢 Notification"
    }
  })()
  
  const notification: Notification = {
    id,
    task_id: taskId || null,
    project_id: resolvedProjectId || null,
    type,
    severity,
    title: notificationTitle,
    message,
    agent: agent || null,
    read: 0,
    created_at: now,
  }
  
  db.prepare(`
    INSERT INTO notifications (id, task_id, project_id, type, severity, title, message, agent, read, created_at)
    VALUES (@id, @task_id, @project_id, @type, @severity, @title, @message, @agent, @read, @created_at)
  `).run(notification)
  
  // If escalation on a task, also add a comment
  if (taskId && (type === "escalation" || type === "request_input")) {
    const commentType = type === "escalation" ? "message" : "request_input"
    const commentContent = type === "escalation" 
      ? `## 🚨 Escalation (${severity})\n\n${message}`
      : `## ❓ Input Requested\n\n${message}`
    
    db.prepare(`
      INSERT INTO comments (id, task_id, author, author_type, content, type, created_at)
      VALUES (?, ?, ?, 'agent', ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      taskId,
      agent || "agent",
      commentContent,
      commentType,
      now
    )
  }
  
  return NextResponse.json({ 
    notification,
    success: true,
  }, { status: 201 })
}
