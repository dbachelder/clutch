"use client"

import { useEffect, useRef } from "react"
import { MessageSquare } from "lucide-react"
import { MessageBubble } from "./message-bubble"
import { StreamingMessage } from "./streaming-message"
import type { ChatMessage } from "@/lib/db/types"

interface TypingIndicator {
  author: string
  state: "thinking" | "typing"
}

interface StreamingMessage {
  author: string
  content: string
  timestamp: number
}

interface ChatThreadProps {
  messages: ChatMessage[]
  streamingMessage?: StreamingMessage | null
  loading?: boolean
  currentUser?: string
  onCreateTask?: (message: ChatMessage) => void
  typingIndicators?: TypingIndicator[]
}

export function ChatThread({ 
  messages, 
  streamingMessage = null,
  loading = false, 
  currentUser = "dan",
  onCreateTask,
  typingIndicators = [],
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages, streaming content, or typing indicator
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, streamingMessage?.content, typingIndicators.length])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading messages...</div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-3" />
          <p className="text-[var(--text-muted)]">No messages yet</p>
          <p className="text-sm text-[var(--text-muted)]">Start the conversation!</p>
        </div>
      </div>
    )
  }

  // Group consecutive messages by same author
  const groupedMessages: { author: string; messages: ChatMessage[] }[] = []
  messages.forEach((msg) => {
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    if (lastGroup && lastGroup.author === msg.author) {
      lastGroup.messages.push(msg)
    } else {
      groupedMessages.push({ author: msg.author, messages: [msg] })
    }
  })

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-1">
          {group.messages.map((message, msgIndex) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.author === currentUser}
              showAuthor={msgIndex === 0}
              onCreateTask={onCreateTask}
            />
          ))}
        </div>
      ))}
      
      {/* Streaming message */}
      {streamingMessage && (
        <div className="space-y-1">
          <StreamingMessage
            author={streamingMessage.author}
            content={streamingMessage.content}
            timestamp={streamingMessage.timestamp}
            isOwnMessage={streamingMessage.author === currentUser}
          />
        </div>
      )}
      
      {/* Typing indicator */}
      {typingIndicators.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-sm text-[var(--text-muted)]">
            {typingIndicators.map((t) => t.author).join(", ")} {typingIndicators.length === 1 ? "is" : "are"} {typingIndicators[0]?.state === "thinking" ? "thinking..." : "typing..."}
          </span>
        </div>
      )}
      
      <div ref={bottomRef} />
    </div>
  )
}
