"use client"

import { useEffect, useState, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw, Loader2, MessageSquare, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOpenClawRpc } from "@/lib/hooks/use-openclaw-rpc"

type PageProps = {
  params: Promise<{ slug: string; sessionKey: string }>
}

type PreviewItem = {
  role: "user" | "assistant" | "system"
  text: string
}

export default function SessionDetailPage({ params }: PageProps) {
  const { slug, sessionKey } = use(params)
  const decodedSessionKey = decodeURIComponent(sessionKey)
  const router = useRouter()
  const { connected, getSessionPreviewRaw } = useOpenClawRpc()
  const [messages, setMessages] = useState<PreviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!connected) return
    
    setLoading(true)
    try {
      const response = await getSessionPreviewRaw(decodedSessionKey, 100)
      // sessions.preview returns { previews: [{ key, status, items }] }
      const preview = response?.previews?.[0]
      if (preview?.status === 'ok' || preview?.status === 'empty') {
        setMessages((preview.items || []) as PreviewItem[])
        setError(null)
      } else if (preview?.status === 'missing') {
        setError('Session not found')
      } else {
        setError('Failed to load session')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session history')
    } finally {
      setLoading(false)
    }
  }, [connected, getSessionPreviewRaw, decodedSessionKey])

  useEffect(() => {
    if (connected) {
      fetchHistory()
    }
  }, [connected, fetchHistory])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push(`/projects/${slug}/sessions`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold font-mono truncate">{decodedSessionKey}</h2>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchHistory}
          disabled={!connected || loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && messages.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No messages in this session</p>
        </div>
      )}

      {/* Messages */}
      {!loading && messages.length > 0 && (
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg ${
                msg.role === "assistant" 
                  ? "bg-accent/30 border border-accent/50" 
                  : msg.role === "system"
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "bg-card border"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  msg.role === "assistant" 
                    ? "bg-primary/20 text-primary" 
                    : msg.role === "system"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-muted"
                }`}>
                  {msg.role === "assistant" ? (
                    <Bot className="h-4 w-4" />
                  ) : msg.role === "system" ? (
                    <MessageSquare className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium capitalize">{msg.role}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
