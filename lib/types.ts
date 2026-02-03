export interface Session {
  key: string
  agentId: string
  label?: string
  model?: string
  status: 'running' | 'idle' | 'terminated' | 'error'
  lastActivity?: string
  spawnedBy?: string
  usage?: {
    tokens?: number
    cost?: number
  }
  createdAt?: string
  pid?: number
}

export interface SessionKillRequest {
  sessionKey: string
  force?: boolean
}

export interface SessionKillResponse {
  success: boolean
  message?: string
  error?: string
}

export interface WebSocketMessage {
  type: string
  data?: any
  sessionKey?: string
  session?: Session
}