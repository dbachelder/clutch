"use client"

import { useEffect, useState, use } from "react"
import { Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SessionCard } from "@/components/sessions/session-card"

type PageProps = {
  params: Promise<{ slug: string }>
}

// Mock sessions for now - will be replaced with real OpenClaw data in Phase 4
interface MockSession {
  id: string
  agent: string
  status: "working" | "idle" | "stuck" | "completed" | "failed"
  taskId?: string
  taskTitle?: string
  description?: string
  startedAt: number
  updatedAt: number
}

export default function SessionsPage({ params }: PageProps) {
  const { slug } = use(params)
  const [sessions, setSessions] = useState<MockSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      // Empty for now - will connect to OpenClaw in Phase 4
      setSessions([])
      setLoading(false)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [slug])

  const activeSessions = sessions.filter(s => 
    s.status === "working" || s.status === "idle" || s.status === "stuck"
  )
  const completedSessions = sessions.filter(s => 
    s.status === "completed" || s.status === "failed"
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Sessions</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Agent sessions for this project
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLoading(true)}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-[var(--text-muted)]">Loading sessions...</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-4" />
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
            No active sessions
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Sessions will appear here when agents are working on tasks.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Agent integration coming in Phase 4
          </p>
        </div>
      ) : (
        <>
          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Active Sessions ({activeSessions.length})
              </h3>
              <div className="space-y-2">
                {activeSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session}
                    onClick={() => {
                      // Navigate to session detail - will implement in #76
                      console.log("View session:", session.id)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Sessions */}
          {completedSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Recent Completed ({completedSessions.length})
              </h3>
              <div className="space-y-2">
                {completedSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session}
                    onClick={() => {
                      console.log("View session:", session.id)
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
