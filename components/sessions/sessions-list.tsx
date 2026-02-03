'use client'

import Link from 'next/link'
import { Session } from '@/lib/types'
import KillButton from './kill-button'

interface SessionsListProps {
  sessions: Session[]
  onSessionKilled: (sessionKey: string) => void
}

export default function SessionsList({ sessions, onSessionKilled }: SessionsListProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No sessions found.</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {sessions.map((session) => (
          <li key={session.key}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      session.status === 'running' 
                        ? 'bg-green-100 text-green-800' 
                        : session.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <Link 
                        href={`/sessions/${encodeURIComponent(session.key)}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-900"
                      >
                        {session.label || session.key}
                      </Link>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span>Agent: {session.agentId}</span>
                      {session.model && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Model: {session.model}</span>
                        </>
                      )}
                      {session.spawnedBy && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Spawned by: {session.spawnedBy}</span>
                        </>
                      )}
                    </div>
                    {session.lastActivity && (
                      <div className="mt-1 text-sm text-gray-500">
                        Last activity: {new Date(session.lastActivity).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {session.usage && (
                    <div className="text-sm text-gray-500">
                      {session.usage.tokens && (
                        <span className="block">{session.usage.tokens} tokens</span>
                      )}
                      {session.usage.cost && (
                        <span className="block">${session.usage.cost.toFixed(4)}</span>
                      )}
                    </div>
                  )}
                  
                  {session.status === 'running' && (
                    <KillButton 
                      session={session} 
                      onSessionKilled={() => onSessionKilled(session.key)}
                      variant="compact"
                    />
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}