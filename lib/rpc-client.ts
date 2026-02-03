import type { JsonRpcRequest, JsonRpcResponse, JsonRpcError } from '../types/rpc'
import type { RpcMethods } from '../types/openclaw'

/**
 * Minimal WebSocket client interface that RpcClient depends on
 * TODO: Replace with actual WebSocketClient when #2 is implemented
 */
export interface WebSocketClient {
  send(data: unknown): void
  subscribe(handler: (message: unknown) => void): void
  unsubscribe(handler: (message: unknown) => void): void
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * Type-safe JSON-RPC 2.0 client for OpenClaw gateway
 * 
 * Handles request/response correlation, timeouts, and provides
 * type safety for known gateway methods.
 */
export class RpcClient {
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private messageHandler = (msg: unknown) => this.handleMessage(msg)

  constructor(private ws: WebSocketClient) {
    this.ws.subscribe(this.messageHandler)
  }

  /**
   * Make a type-safe RPC call to a known method
   */
  async call<T extends keyof RpcMethods>(
    method: T,
    params: RpcMethods[T]['params'],
    timeoutMs = 30000
  ): Promise<RpcMethods[T]['result']>

  /**
   * Make a generic RPC call to any method
   */
  async call<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs = 30000
  ): Promise<T>

  async call<T>(
    method: string,
    params?: unknown,
    timeoutMs = 30000
  ): Promise<T> {
    const id = this.nextId++
    
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, timeoutMs)
      
      this.pending.set(id, { 
        resolve: resolve as (value: unknown) => void, 
        reject, 
        timeout 
      })

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        ...(params !== undefined && { params })
      }
      
      this.ws.send(request)
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(msg: unknown): void {
    try {
      const response = this.parseResponse(msg)
      if (!response || typeof response.id !== 'number') {
        // Not a JSON-RPC response or notification we care about
        return
      }

      const pending = this.pending.get(response.id)
      if (!pending) {
        // Response for unknown request ID
        return
      }

      this.pending.delete(response.id)
      clearTimeout(pending.timeout)

      if (response.error) {
        const error = new RpcError(
          response.error.message,
          response.error.code,
          response.error.data
        )
        pending.reject(error)
      } else {
        pending.resolve(response.result)
      }
    } catch (err) {
      // Invalid JSON or parsing error - ignore
      console.warn('Failed to parse RPC message:', err)
    }
  }

  /**
   * Parse and validate a JSON-RPC response
   */
  private parseResponse(msg: unknown): JsonRpcResponse | null {
    if (typeof msg !== 'object' || msg === null) {
      return null
    }
    
    const obj = msg as Record<string, unknown>
    
    if (obj.jsonrpc !== "2.0" || typeof obj.id !== 'number') {
      return null
    }

    return obj as JsonRpcResponse
  }

  /**
   * Clean up pending requests and unsubscribe from WebSocket
   */
  dispose(): void {
    // Cancel all pending requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('RPC client disposed'))
    }
    this.pending.clear()

    // Unsubscribe from WebSocket messages
    this.ws.unsubscribe(this.messageHandler)
  }
}

/**
 * JSON-RPC error with code and optional data
 */
export class RpcError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: unknown
  ) {
    super(message)
    this.name = 'RpcError'
  }
}