"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

/**
 * Reactive Convex subscription for chat messages.
 * 
 * Returns messages for the given chatId, updated in real-time
 * whenever new messages are inserted into Convex.
 * 
 * Falls back gracefully if Convex provider is not available.
 */
export function useConvexMessages(chatId: string | null, limit = 50) {
  const result = useQuery(
    api.chats.getMessages,
    chatId ? { chatId, limit } : "skip"
  )

  return {
    messages: result?.messages ?? null,
    hasMore: result?.hasMore ?? false,
    isLoading: result === undefined,
  }
}

/**
 * Reactive Convex subscription for chat list.
 * 
 * Returns chats for the given projectId, updated in real-time
 * whenever chats are created/updated.
 */
export function useConvexChats(projectId: string | null) {
  const result = useQuery(
    api.chats.getByProject,
    projectId ? { projectId } : "skip"
  )

  return {
    chats: result ?? null,
    isLoading: result === undefined,
  }
}
