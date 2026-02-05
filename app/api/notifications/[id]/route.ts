import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type RouteContext = {
  params: Promise<{ id: string }>
}

// PATCH /api/notifications/:id — Update notification (mark read)
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  const body = await request.json()
  
  const existing = db.prepare("SELECT id FROM notifications WHERE id = ?").get(id)
  if (!existing) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  }
  
  if (body.read !== undefined) {
    db.prepare("UPDATE notifications SET read = ? WHERE id = ?").run(body.read ? 1 : 0, id)
  }
  
  const notification = db.prepare("SELECT * FROM notifications WHERE id = ?").get(id)
  
  return NextResponse.json({ notification })
}

// DELETE /api/notifications/:id — Delete notification
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  
  const result = db.prepare("DELETE FROM notifications WHERE id = ?").run(id)
  
  if (result.changes === 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  }
  
  return NextResponse.json({ success: true })
}
