"use client"

import { useCallback, useRef, useEffect, useState } from "react"
import { SessionListResponse, SessionListParams } from "@/lib/types"

// Fallback for non-secure contexts where crypto.randomUUID isn't available
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Dynamic WebSocket URL based on page protocol
function getWebSocketUrl(): string {
  if (typeof window === "undefined") return ""
  
  if (window.location.protocol === "https:") {
    return `wss://${window.location.host}/openclaw-ws`
  }
  
  return process.env.NEXT_PUBLIC_OPENCLAW_WS_URL || ""
}

const AUTH_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_TOKEN || ""

interface RPCResponse<T> {
  type: "res"
  id: string
  ok: boolean
  payload?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export function useOpenClawRpc() {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const connectingRef = useRef(false)
  const pendingRequests = useRef<Map<string, PendingRequest<unknown>>>(new Map())
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Clear all pending requests with an error
  const clearPendingRequests = useCallback((errorMessage: string) => {
    const error = new Error(errorMessage)
    pendingRequests.current.forEach((req) => {
      clearTimeout(req.timeout)
      req.reject(error)
    })
    pendingRequests.current.clear()
  }, [])

  // Connect to OpenClaw WebSocket
  const connect = useCallback(() => {
    const wsUrl = getWebSocketUrl()
    if (!wsUrl) {
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    if (connectingRef.current) {
      return
    }

    connectingRef.current = true
    if (mountedRef.current) setConnecting(true)
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      const connectId = generateUUID()
      
      const timeout = setTimeout(() => {
        if (pendingRequests.current.has(connectId)) {
          pendingRequests.current.delete(connectId)
          ws.close()
          connectingRef.current = false
          if (mountedRef.current) setConnecting(false)
        }
      }, 10000)
      
      pendingRequests.current.set(connectId, {
        resolve: () => {
          if (mountedRef.current) {
            setConnected(true)
            setConnecting(false)
          }
          connectingRef.current = false
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }
        },
        reject: (e) => {
          console.error("[OpenClawRPC] Connect handshake failed:", e)
          connectingRef.current = false
          if (mountedRef.current) setConnecting(false)
          ws.close()
        },
        timeout,
      })
      
      ws.send(JSON.stringify({
        type: "req",
        id: connectId,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "webchat",
            version: "1.0.0",
            platform: "web",
            mode: "webchat",
          },
          auth: {
            token: AUTH_TOKEN
          }
        }
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RPCResponse<unknown>
        
        if (data.type === "res" && data.id && pendingRequests.current.has(data.id)) {
          const pending = pendingRequests.current.get(data.id)!
          pendingRequests.current.delete(data.id)
          clearTimeout(pending.timeout)
          
          if (!data.ok || data.error) {
            const errorMessage = data.error?.message || "RPC error"
            pending.reject(new Error(errorMessage))
          } else {
            pending.resolve(data.payload)
          }
          return
        }
      } catch (e) {
        console.error("[OpenClawRPC] Failed to parse message:", e)
      }
    }

    ws.onclose = (event) => {
      console.log("[OpenClawRPC] Disconnected", event.code, event.reason)
      if (mountedRef.current) {
        setConnected(false)
        setConnecting(false)
      }
      connectingRef.current = false
      
      clearPendingRequests("WebSocket disconnected")
      
      // Reconnect after delay
      if (mountedRef.current) {
        const delay = Math.min(1000 * Math.pow(2, Math.random() * 2), 30000)
        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = (error) => {
      console.error("[OpenClawRPC] WebSocket error:", error)
      connectingRef.current = false
      if (mountedRef.current) setConnecting(false)
    }
  }, [clearPendingRequests])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    clearPendingRequests("Disconnected by user")
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setConnected(false)
    connectingRef.current = false
    setConnecting(false)
  }, [clearPendingRequests])

  // Generic RPC request method
  const rpc = useCallback(async <T>(method: string, params?: Record<string, unknown>): Promise<T> => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected")
    }

    const id = generateUUID()
    
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (pendingRequests.current.has(id)) {
          pendingRequests.current.delete(id)
          reject(new Error(`RPC timeout for method: ${method}`))
        }
      }, 60000)
      
      pendingRequests.current.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      })
      
      try {
        wsRef.current!.send(JSON.stringify({
          type: "req",
          id,
          method,
          params: params || {},
        }))
      } catch (error) {
        pendingRequests.current.delete(id)
        clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }, [])

  // List sessions via RPC
  const listSessions = useCallback(async (params?: SessionListParams): Promise<SessionListResponse> => {
    return rpc<SessionListResponse>("sessions.list", (params || {}) as Record<string, unknown>)
  }, [rpc])

  // Get session preview with history
  const getSessionPreview = useCallback(async (sessionKey: string, limit?: number) => {
    return rpc<{ session: unknown; messages: unknown[] }>("sessions.preview", { sessionKey, limit: limit || 50 })
  }, [rpc])

  // Reset session
  const resetSession = useCallback(async (sessionKey: string) => {
    return rpc<void>("sessions.reset", { sessionKey })
  }, [rpc])

  // Compact session context
  const compactSession = useCallback(async (sessionKey: string) => {
    return rpc<void>("sessions.compact", { sessionKey })
  }, [rpc])

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    connect()
    
    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [connect, disconnect])

  return {
    connected,
    connecting,
    connect,
    disconnect,
    rpc,
    listSessions,
    getSessionPreview,
    resetSession,
    compactSession,
  }
}

export default useOpenClawRpc
