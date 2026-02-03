'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Session } from '@/lib/types'
import { getSession, connectWebSocket } from '@/lib/openclaw-client'
import KillButton from '@/components/sessions/kill-button'

interface SessionDetailPageProps {
  params: {
    id: string
  }
}

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null

    async function loadSession() {
      try {
        // Connect to WebSocket for real-time updates
        ws = await connectWebSocket()
        
        // Load session details
        const sessionData = await getSession(params.id)
        setSession(sessionData)
        setLoading(false)
        
        // Set up real-time updates for this session
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          if (data.type === 'session_update' && data.sessionKey === params.id) {
            setSession(data.session)
          } else if (data.type === 'session_deleted' && data.sessionKey === params.id) {
            router.push('/sessions')
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session')
        setLoading(false)
      }
    }

    loadSession()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [params.id, router])

  const handleSessionKilled = () => {
    // Navigate back to sessions list after killing
    router.push('/sessions')
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
          <h3 className="text-lg font-medium text-red-800">Error Loading Session</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="px-4 sm:px-0">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Session not found</h3>
          <p className="text-gray-600">The session you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Session Details</h1>
          <p className="mt-2 text-sm text-gray-700">
            Session key: {session.key}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          {session.status === 'running' && (
            <KillButton
              session={session}
              onSessionKilled={handleSessionKilled}
              variant="danger"
            />
          )}
        </div>
      </div>
      
      <div className="mt-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Session Information
            </h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    session.status === 'running' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {session.status}
                  </span>
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Model</dt>
                <dd className="mt-1 text-sm text-gray-900">{session.model || 'Default'}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Agent ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{session.agentId}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Activity</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {session.lastActivity ? new Date(session.lastActivity).toLocaleString() : 'Unknown'}
                </dd>
              </div>
              
              {session.label && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Label</dt>
                  <dd className="mt-1 text-sm text-gray-900">{session.label}</dd>
                </div>
              )}
              
              {session.spawnedBy && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Spawned By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{session.spawnedBy}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}