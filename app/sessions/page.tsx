'use client'

import { useState, useEffect } from 'react'
import SessionsList from '@/components/sessions/sessions-list'
import { Session } from '@/lib/types'
import { connectWebSocket, listSessions } from '@/lib/openclaw-client'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null

    async function initializeSessionsPage() {
      try {
        // Connect to OpenClaw WebSocket
        ws = await connectWebSocket()
        
        // Load initial sessions list
        const initialSessions = await listSessions()
        setSessions(initialSessions)
        setLoading(false)
        
        // Set up real-time updates
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          if (data.type === 'session_update' || data.type === 'session_created' || data.type === 'session_deleted') {
            // Reload sessions when there are updates
            listSessions().then(setSessions)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to OpenClaw')
        setLoading(false)
      }
    }

    initializeSessionsPage()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  const handleSessionKilled = (sessionKey: string) => {
    // Update sessions list after a session is killed
    setSessions(prev => prev.filter(s => s.key !== sessionKey))
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-red-800">Connection Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Sessions</h1>
          <p className="mt-2 text-sm text-gray-700">
            Active and recent OpenClaw sessions with management controls.
          </p>
        </div>
      </div>
      <div className="mt-8">
        <SessionsList sessions={sessions} onSessionKilled={handleSessionKilled} />
      </div>
    </div>
  )
}