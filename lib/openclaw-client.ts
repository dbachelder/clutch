import { Session, SessionKillRequest, SessionKillResponse } from './types'

const OPENCLAW_WS_URL = 'ws://localhost:18789'
const OPENCLAW_API_URL = 'http://localhost:18789'

export async function connectWebSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(OPENCLAW_WS_URL)
    
    ws.onopen = () => {
      resolve(ws)
    }
    
    ws.onerror = () => {
      reject(new Error('Failed to connect to OpenClaw WebSocket'))
    }
    
    // Set a timeout for the connection
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close()
        reject(new Error('WebSocket connection timeout'))
      }
    }, 5000)
  })
}

export async function listSessions(): Promise<Session[]> {
  try {
    const response = await fetch(`${OPENCLAW_API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'sessions.list',
        params: {
          includeLastMessage: true,
          includeDerivedTitles: true,
          limit: 100
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error.message || 'Failed to list sessions')
    }
    
    return mapSessionsResponse(data.result || [])
  } catch (error) {
    console.error('Error listing sessions:', error)
    throw error
  }
}

export async function getSession(sessionKey: string): Promise<Session> {
  try {
    const response = await fetch(`${OPENCLAW_API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'sessions.resolve',
        params: {
          key: sessionKey
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error.message || 'Failed to get session')
    }
    
    if (!data.result) {
      throw new Error('Session not found')
    }
    
    return mapSessionResponse(data.result)
  } catch (error) {
    console.error('Error getting session:', error)
    throw error
  }
}

export async function killSession(request: SessionKillRequest): Promise<SessionKillResponse> {
  try {
    const response = await fetch(`${OPENCLAW_API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'sessions.delete',
        params: {
          key: request.sessionKey,
          deleteTranscript: false
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      return {
        success: false,
        error: data.error.message || 'Failed to kill session'
      }
    }
    
    return {
      success: true,
      message: 'Session killed successfully'
    }
  } catch (error) {
    console.error('Error killing session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function mapSessionResponse(sessionData: any): Session {
  return {
    key: sessionData.key || sessionData.sessionKey,
    agentId: sessionData.agentId || 'unknown',
    label: sessionData.label,
    model: sessionData.model,
    status: determineSessionStatus(sessionData),
    lastActivity: sessionData.lastActivity || sessionData.modifiedAt,
    spawnedBy: sessionData.spawnedBy,
    usage: sessionData.usage,
    createdAt: sessionData.createdAt,
    pid: sessionData.pid
  }
}

function mapSessionsResponse(sessionsData: any[]): Session[] {
  return sessionsData.map(mapSessionResponse)
}

function determineSessionStatus(sessionData: any): Session['status'] {
  // Logic to determine if a session is running based on available data
  // This might need to be adjusted based on actual OpenClaw API responses
  if (sessionData.status) {
    return sessionData.status
  }
  
  if (sessionData.pid && sessionData.pid > 0) {
    return 'running'
  }
  
  if (sessionData.lastActivity) {
    const lastActivity = new Date(sessionData.lastActivity)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / 1000 / 60
    
    // Consider sessions active if last activity was within 5 minutes
    if (diffMinutes < 5) {
      return 'running'
    }
  }
  
  return 'idle'
}