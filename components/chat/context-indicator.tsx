"use client"

import { useState, useEffect, useCallback } from "react"

interface ContextIndicatorProps {
  sessionKey?: string
  onUpdate?: () => void
}

export function ContextIndicator({ 
  sessionKey = "main",
  onUpdate 
}: ContextIndicatorProps) {
  const [contextData, setContextData] = useState<{
    percentage: number
    tokens: number
    total: number
    model?: string
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchContextData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/sessions/list?activeMinutes=60&limit=200", {
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) {
        setContextData(null)
        return
      }
      const data = await response.json()
      const sessions: Array<Record<string, unknown>> = data.sessions || []
      const session = sessions.find((s) => s.id === sessionKey)
        || sessions.find((s) => String(s.id || "").endsWith(sessionKey))

      if (!session) {
        setContextData(null)
        return
      }

      const tokens = (session.tokens as { total?: number } | undefined)?.total ?? 0
      // Default context window estimate
      const total = 200000
      const percentage = total > 0 ? Math.round((tokens / total) * 100) : 0

      setContextData({
        percentage,
        tokens,
        total,
        model: session.model as string | undefined,
      })
    } catch {
      setContextData(null)
    } finally {
      setLoading(false)
    }
  }, [sessionKey])

  // Initial fetch and periodic updates (every 30s — not critical data)
  useEffect(() => {
    fetchContextData()
    const interval = setInterval(fetchContextData, 30000)
    return () => clearInterval(interval)
  }, [sessionKey, fetchContextData])

  // Fetch after updates (when onUpdate is called)
  useEffect(() => {
    if (onUpdate) {
      fetchContextData()
    }
  }, [onUpdate, fetchContextData])

  if (!contextData) {
    return null
  }

  const formatTokens = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return "bg-green-500"
    if (percentage < 80) return "bg-yellow-500"
    return "bg-red-500"
  }

  const displayModel = contextData.model?.split("/").pop() || contextData.model

  return (
    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
      <div className="flex items-center gap-2">
        <span>Context:</span>
        <span className="font-medium">
          {formatTokens(contextData.tokens)}/{formatTokens(contextData.total)} 
          ({Math.round(contextData.percentage)}%)
        </span>
        
        {/* Progress bar */}
        <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${getProgressColor(contextData.percentage)}`}
            style={{ width: `${Math.min(contextData.percentage, 100)}%` }}
          />
        </div>
        
        {loading && (
          <span className="text-[var(--text-muted)]/70">updating...</span>
        )}
      </div>
      
      {displayModel && (
        <span className="text-[var(--text-muted)]/70">
          {displayModel}
        </span>
      )}
    </div>
  )
}