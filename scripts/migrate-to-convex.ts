/**
 * Migration script: SQLite → Convex
 * 
 * Reads all data from SQLite and inserts into Convex.
 * Designed to be idempotent - can be run multiple times safely.
 * 
 * Usage:
 *   pnpm convex:migrate
 * 
 * Requires environment variables:
 *   - CONVEX_SELF_HOSTED_URL
 *   - CONVEX_SELF_HOSTED_ADMIN_KEY
 *   - DATABASE_PATH (optional, defaults to ~/.trap/trap.db)
 */

import Database from "better-sqlite3"
import fs from "fs"
import path from "path"

// Configuration
const CONVEX_URL = process.env.CONVEX_SELF_HOSTED_URL?.replace(/\/$/, '') // Remove trailing slash
const ADMIN_KEY = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
const DB_PATH = process.env.DATABASE_PATH || 
  path.join(process.env.HOME || "", ".trap", "trap.db")

const SQLITE_BACKUP_PATH = `${DB_PATH}.backup-${Date.now()}`

// ID mapping: SQLite ID → Convex ID
const projectIdMap = new Map<string, string>()
const taskIdMap = new Map<string, string>()
const chatIdMap = new Map<string, string>()

// Statistics
const stats = {
  projects: { migrated: 0, skipped: 0, errors: 0 },
  tasks: { migrated: 0, skipped: 0, errors: 0 },
  comments: { migrated: 0, skipped: 0, errors: 0 },
  chats: { migrated: 0, skipped: 0, errors: 0 },
  chatMessages: { migrated: 0, skipped: 0, errors: 0 },
  notifications: { migrated: 0, skipped: 0, errors: 0 },
  events: { migrated: 0, skipped: 0, errors: 0 },
  signals: { migrated: 0, skipped: 0, errors: 0 },
  taskDependencies: { migrated: 0, skipped: 0, errors: 0 },
}

// SQLite row types
interface SqliteProject {
  id: string
  slug: string
  name: string
  description: string | null
  color: string
  repo_url: string | null
  context_path: string | null
  local_path: string | null
  github_repo: string | null
  chat_layout: string
  work_loop_enabled: number
  work_loop_schedule: string
  created_at: number
  updated_at: number
}

interface SqliteTask {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  priority: string
  role: string | null
  assignee: string | null
  requires_human_review: number
  tags: string | null
  session_id: string | null
  dispatch_status: string | null
  dispatch_requested_at: number | null
  dispatch_requested_by: string | null
  position: number
  created_at: number
  updated_at: number
  completed_at: number | null
}

interface SqliteComment {
  id: string
  task_id: string
  author: string
  author_type: string
  content: string
  type: string
  responded_at: number | null
  created_at: number
}

interface SqliteChat {
  id: string
  project_id: string
  title: string
  participants: string | null
  session_key: string | null
  created_at: number
  updated_at: number
}

interface SqliteChatMessage {
  id: string
  chat_id: string
  author: string
  content: string
  run_id: string | null
  session_key: string | null
  is_automated: number | null
  created_at: number
}

interface SqliteNotification {
  id: string
  task_id: string | null
  project_id: string | null
  type: string
  severity: string
  title: string
  message: string
  agent: string | null
  read: number
  created_at: number
}

interface SqliteEvent {
  id: string
  project_id: string | null
  task_id: string | null
  type: string
  actor: string
  data: string | null
  created_at: number
}

interface SqliteSignal {
  id: string
  task_id: string
  session_key: string
  agent_id: string
  kind: string
  severity: string
  message: string
  blocking: number
  responded_at: number | null
  response: string | null
  created_at: number
}

interface SqliteTaskDependency {
  id: string
  task_id: string
  depends_on_id: string
  created_at: number
}

function validateEnv(): void {
  if (!CONVEX_URL) {
    throw new Error("CONVEX_SELF_HOSTED_URL environment variable is required")
  }
  if (!ADMIN_KEY) {
    throw new Error("CONVEX_SELF_HOSTED_ADMIN_KEY environment variable is required")
  }
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`SQLite database not found at ${DB_PATH}`)
  }
}

function backupDatabase(): void {
  console.log(`Creating backup: ${SQLITE_BACKUP_PATH}`)
  fs.copyFileSync(DB_PATH, SQLITE_BACKUP_PATH)
  console.log("✓ Backup created")
}

async function convexMutation(mutationPath: string, args: Record<string, unknown>): Promise<{ _id: string; skipped: boolean }> {
  const url = `${CONVEX_URL}/api/mutation`
  const body = {
    path: mutationPath,
    args
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ADMIN_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Convex mutation failed: ${response.status} - ${text}`)
  }

  const result = await response.json()
  return result as { _id: string; skipped: boolean }
}

function parseJsonField<T>(field: string | null, defaultValue: T): T {
  if (!field) return defaultValue
  try {
    return JSON.parse(field) as T
  } catch {
    return defaultValue
  }
}

async function migrateProjects(db: Database.Database): Promise<void> {
  console.log("\n📁 Migrating projects...")
  const rows = db.prepare("SELECT * FROM projects").all() as SqliteProject[]

  for (const row of rows) {
    try {
      const result = await convexMutation("migrate:createProject", {
        slug: row.slug,
        name: row.name,
        description: row.description || undefined,
        color: row.color || "#3b82f6",
        repo_url: row.repo_url || undefined,
        context_path: row.context_path || undefined,
        local_path: row.local_path || undefined,
        github_repo: row.github_repo || undefined,
        chat_layout: row.chat_layout || "slack",
        work_loop_enabled: Boolean(row.work_loop_enabled),
        work_loop_schedule: row.work_loop_schedule || "*/5 * * * *",
        created_at: row.created_at,
        updated_at: row.updated_at,
      })

      projectIdMap.set(row.id, result._id)
      
      if (result.skipped) {
        stats.projects.skipped++
        console.log(`  ⏭ ${row.slug} (already exists)`)
      } else {
        stats.projects.migrated++
        console.log(`  ✓ ${row.slug} → ${result._id.slice(0, 8)}...`)
      }
    } catch (error) {
      stats.projects.errors++
      console.error(`  ✗ ${row.slug}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.projects.migrated}, Skipped: ${stats.projects.skipped}, Errors: ${stats.projects.errors}`)
}

async function migrateTasks(db: Database.Database): Promise<void> {
  console.log("\n📋 Migrating tasks...")
  const rows = db.prepare("SELECT * FROM tasks").all() as SqliteTask[]

  for (const row of rows) {
    try {
      const convexProjectId = projectIdMap.get(row.project_id)
      if (!convexProjectId) {
        console.warn(`  ⚠ Skipping task "${row.title}": project ${row.project_id} not found`)
        stats.tasks.skipped++
        continue
      }

      const result = await convexMutation("migrate:createTask", {
        project_id: convexProjectId,
        title: row.title,
        description: row.description || undefined,
        status: row.status,
        priority: row.priority,
        role: row.role || undefined,
        assignee: row.assignee || undefined,
        requires_human_review: Boolean(row.requires_human_review),
        tags: row.tags ? parseJsonField<string[]>(row.tags, []) : undefined,
        session_id: row.session_id || undefined,
        dispatch_status: row.dispatch_status || undefined,
        dispatch_requested_at: row.dispatch_requested_at || undefined,
        dispatch_requested_by: row.dispatch_requested_by || undefined,
        position: row.position || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at || undefined,
      })

      taskIdMap.set(row.id, result._id)
      
      if (result.skipped) {
        stats.tasks.skipped++
      } else {
        stats.tasks.migrated++
      }
    } catch (error) {
      stats.tasks.errors++
      console.error(`  ✗ Task "${row.title.slice(0, 30)}...":`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.tasks.migrated}, Skipped: ${stats.tasks.skipped}, Errors: ${stats.tasks.errors}`)
}

async function migrateComments(db: Database.Database): Promise<void> {
  console.log("\n💬 Migrating comments...")
  const rows = db.prepare("SELECT * FROM comments").all() as SqliteComment[]

  for (const row of rows) {
    try {
      const convexTaskId = taskIdMap.get(row.task_id)
      if (!convexTaskId) {
        stats.comments.skipped++
        continue
      }

      const result = await convexMutation("migrate:createComment", {
        task_id: convexTaskId,
        author: row.author,
        author_type: row.author_type,
        content: row.content,
        type: row.type,
        responded_at: row.responded_at || undefined,
        created_at: row.created_at,
      })

      if (result.skipped) {
        stats.comments.skipped++
      } else {
        stats.comments.migrated++
      }
    } catch (error) {
      stats.comments.errors++
      console.error(`  ✗ Comment ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.comments.migrated}, Skipped: ${stats.comments.skipped}, Errors: ${stats.comments.errors}`)
}

async function migrateChats(db: Database.Database): Promise<void> {
  console.log("\n💭 Migrating chats...")
  const rows = db.prepare("SELECT * FROM chats").all() as SqliteChat[]

  for (const row of rows) {
    try {
      const convexProjectId = projectIdMap.get(row.project_id)
      if (!convexProjectId) {
        stats.chats.skipped++
        continue
      }

      const result = await convexMutation("migrate:createChat", {
        project_id: convexProjectId,
        title: row.title,
        participants: row.participants ? parseJsonField<string[]>(row.participants, []) : undefined,
        session_key: row.session_key || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })

      chatIdMap.set(row.id, result._id)
      
      if (result.skipped) {
        stats.chats.skipped++
      } else {
        stats.chats.migrated++
      }
    } catch (error) {
      stats.chats.errors++
      console.error(`  ✗ Chat ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.chats.migrated}, Skipped: ${stats.chats.skipped}, Errors: ${stats.chats.errors}`)
}

async function migrateChatMessages(db: Database.Database): Promise<void> {
  console.log("\n📨 Migrating chat messages...")
  const rows = db.prepare("SELECT * FROM chat_messages").all() as SqliteChatMessage[]

  for (const row of rows) {
    try {
      const convexChatId = chatIdMap.get(row.chat_id)
      if (!convexChatId) {
        stats.chatMessages.skipped++
        continue
      }

      const result = await convexMutation("migrate:createChatMessage", {
        chat_id: convexChatId,
        author: row.author,
        content: row.content,
        run_id: row.run_id || undefined,
        session_key: row.session_key || undefined,
        is_automated: row.is_automated !== null ? Boolean(row.is_automated) : undefined,
        created_at: row.created_at,
      })

      if (result.skipped) {
        stats.chatMessages.skipped++
      } else {
        stats.chatMessages.migrated++
      }
    } catch (error) {
      stats.chatMessages.errors++
      console.error(`  ✗ Chat message ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.chatMessages.migrated}, Skipped: ${stats.chatMessages.skipped}, Errors: ${stats.chatMessages.errors}`)
}

async function migrateNotifications(db: Database.Database): Promise<void> {
  console.log("\n🔔 Migrating notifications...")
  const rows = db.prepare("SELECT * FROM notifications").all() as SqliteNotification[]

  for (const row of rows) {
    try {
      const convexTaskId = row.task_id ? taskIdMap.get(row.task_id) : undefined
      const convexProjectId = row.project_id ? projectIdMap.get(row.project_id) : undefined

      // Skip if task/project was referenced but not found
      if (row.task_id && !convexTaskId) {
        stats.notifications.skipped++
        continue
      }
      if (row.project_id && !convexProjectId) {
        stats.notifications.skipped++
        continue
      }

      const result = await convexMutation("migrate:createNotification", {
        task_id: convexTaskId,
        project_id: convexProjectId,
        type: row.type,
        severity: row.severity,
        title: row.title,
        message: row.message,
        agent: row.agent || undefined,
        read: Boolean(row.read),
        created_at: row.created_at,
      })

      if (result.skipped) {
        stats.notifications.skipped++
      } else {
        stats.notifications.migrated++
      }
    } catch (error) {
      stats.notifications.errors++
      console.error(`  ✗ Notification ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.notifications.migrated}, Skipped: ${stats.notifications.skipped}, Errors: ${stats.notifications.errors}`)
}

async function migrateEvents(db: Database.Database): Promise<void> {
  console.log("\n📊 Migrating events...")
  const rows = db.prepare("SELECT * FROM events").all() as SqliteEvent[]

  for (const row of rows) {
    try {
      const convexTaskId = row.task_id ? taskIdMap.get(row.task_id) : undefined
      const convexProjectId = row.project_id ? projectIdMap.get(row.project_id) : undefined

      // Skip if task/project was referenced but not found
      if (row.task_id && !convexTaskId) {
        stats.events.skipped++
        continue
      }
      if (row.project_id && !convexProjectId) {
        stats.events.skipped++
        continue
      }

      const result = await convexMutation("migrate:createEvent", {
        project_id: convexProjectId,
        task_id: convexTaskId,
        type: row.type,
        actor: row.actor,
        data: row.data || undefined,
        created_at: row.created_at,
      })

      if (result.skipped) {
        stats.events.skipped++
      } else {
        stats.events.migrated++
      }
    } catch (error) {
      stats.events.errors++
      console.error(`  ✗ Event ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.events.migrated}, Skipped: ${stats.events.skipped}, Errors: ${stats.events.errors}`)
}

async function migrateSignals(db: Database.Database): Promise<void> {
  console.log("\n📡 Migrating signals...")
  const rows = db.prepare("SELECT * FROM signals").all() as SqliteSignal[]

  for (const row of rows) {
    try {
      const convexTaskId = taskIdMap.get(row.task_id)
      if (!convexTaskId) {
        stats.signals.skipped++
        continue
      }

      const result = await convexMutation("migrate:createSignal", {
        task_id: convexTaskId,
        session_key: row.session_key,
        agent_id: row.agent_id,
        kind: row.kind,
        severity: row.severity,
        message: row.message,
        blocking: Boolean(row.blocking),
        responded_at: row.responded_at || undefined,
        response: row.response || undefined,
        created_at: row.created_at,
      })

      if (result.skipped) {
        stats.signals.skipped++
      } else {
        stats.signals.migrated++
      }
    } catch (error) {
      stats.signals.errors++
      console.error(`  ✗ Signal ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.signals.migrated}, Skipped: ${stats.signals.skipped}, Errors: ${stats.signals.errors}`)
}

async function migrateTaskDependencies(db: Database.Database): Promise<void> {
  console.log("\n🔗 Migrating task dependencies...")
  const rows = db.prepare("SELECT * FROM task_dependencies").all() as SqliteTaskDependency[]

  for (const row of rows) {
    try {
      const convexTaskId = taskIdMap.get(row.task_id)
      const convexDependsOnId = taskIdMap.get(row.depends_on_id)
      
      if (!convexTaskId || !convexDependsOnId) {
        stats.taskDependencies.skipped++
        continue
      }

      const result = await convexMutation("migrate:createTaskDependency", {
        task_id: convexTaskId,
        depends_on_id: convexDependsOnId,
        created_at: row.created_at,
      })

      if (result.skipped) {
        stats.taskDependencies.skipped++
      } else {
        stats.taskDependencies.migrated++
      }
    } catch (error) {
      stats.taskDependencies.errors++
      console.error(`  ✗ Dependency ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`  Migrated: ${stats.taskDependencies.migrated}, Skipped: ${stats.taskDependencies.skipped}, Errors: ${stats.taskDependencies.errors}`)
}

function printSummary(): void {
  console.log("\n" + "=".repeat(50))
  console.log("MIGRATION SUMMARY")
  console.log("=".repeat(50))
  
  const entities = [
    ["Projects", stats.projects],
    ["Tasks", stats.tasks],
    ["Comments", stats.comments],
    ["Chats", stats.chats],
    ["Chat Messages", stats.chatMessages],
    ["Notifications", stats.notifications],
    ["Events", stats.events],
    ["Signals", stats.signals],
    ["Task Dependencies", stats.taskDependencies],
  ] as const

  for (const [name, s] of entities) {
    const total = s.migrated + s.skipped + s.errors
    if (total > 0) {
      console.log(`${name.padEnd(20)} migrated: ${s.migrated}, skipped: ${s.skipped}, errors: ${s.errors}`)
    }
  }

  const totalMigrated = Object.values(stats).reduce((a, s) => a + s.migrated, 0)
  const totalSkipped = Object.values(stats).reduce((a, s) => a + s.skipped, 0)
  const totalErrors = Object.values(stats).reduce((a, s) => a + s.errors, 0)

  console.log("-".repeat(50))
  console.log(`Total: migrated ${totalMigrated}, skipped ${totalSkipped}, errors ${totalErrors}`)
  console.log(`\n✅ SQLite backup preserved at: ${SQLITE_BACKUP_PATH}`)
  
  if (totalErrors > 0) {
    console.log("\n⚠️  Some errors occurred. Check logs above for details.")
    process.exit(1)
  }
}

async function main(): Promise<void> {
  console.log("SQLite → Convex Migration")
  console.log("=".repeat(50))
  
  validateEnv()
  console.log(`Source: ${DB_PATH}`)
  console.log(`Target: ${CONVEX_URL}`)
  
  backupDatabase()
  
  const db = new Database(DB_PATH)
  db.pragma("journal_mode = WAL")
  
  try {
    // Migration order: projects → tasks → everything else → dependencies last
    await migrateProjects(db)
    await migrateTasks(db)
    await migrateComments(db)
    await migrateChats(db)
    await migrateChatMessages(db)
    await migrateNotifications(db)
    await migrateEvents(db)
    await migrateSignals(db)
    await migrateTaskDependencies(db)
    
    printSummary()
  } finally {
    db.close()
  }
}

main().catch(error => {
  console.error("Migration failed:", error)
  process.exit(1)
})
