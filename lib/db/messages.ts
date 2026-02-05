/**
 * Chat message database operations with deduplication
 * Uses Convex for data persistence
 */

import { getConvexClient } from "@/lib/convex/server"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { ChatMessage } from "./types"

/**
 * Extract text content from OpenClaw message content (can be string or array)
 */
function extractContent(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") {
    return content
  }

  // Extract text from content array
  return content
    .filter(block => block.type === "text" && block.text)
    .map(block => block.text!)
    .join("\n")
}

/**
 * Find chat ID by session key
 * Session keys have format: trap:{projectSlug}:{chatId}
 */
export async function findChatBySessionKey(sessionKey: string): Promise<string | null> {
  try {
    const convex = getConvexClient()
    const chat = await convex.query(api.chats.findBySessionKey, { sessionKey })
    return chat?.id ?? null
  } catch (error) {
    console.error("[Messages] Error finding chat by session key:", error)
    return null
  }
}

/**
 * Save a message with deduplication via run_id
 * Returns the message ID if saved, null if duplicate
 */
export async function saveMessage(
  chatId: string,
  author: string,
  content: string | Array<{ type: string; text?: string }>,
  options: {
    runId?: string | null
    sessionKey?: string | null
    isAutomated?: boolean
  } = {}
): Promise<string | null> {
  try {
    const textContent = extractContent(content)

    // Skip empty messages
    if (!textContent.trim()) {
      return null
    }

    const convex = getConvexClient()

    // Check for duplicate via run_id
    if (options.runId) {
      const existing = await convex.query(api.chats.getMessageByRunId, { runId: options.runId })
      if (existing) {
        console.log("[Messages] Skipping duplicate message with run_id:", options.runId)
        return null
      }
    }

    // Insert the message
    const message = await convex.mutation(api.chats.createMessage, {
      chat_id: chatId as Id<'chats'>,
      author,
      content: textContent,
      run_id: options.runId || undefined,
      session_key: options.sessionKey || undefined,
      is_automated: options.isAutomated,
    })

    console.log("[Messages] Saved message:", { id: message.id, chatId, author, runId: options.runId })
    return message.id
  } catch (error) {
    console.error("[Messages] Error saving message:", error)
    return null
  }
}

/**
 * Save an OpenClaw chat message event
 * Handles session key → chat ID mapping and deduplication
 */
export async function saveOpenClawMessage(
  sessionKey: string,
  message: {
    role: string
    content: string | Array<{ type: string; text?: string }>
  },
  runId?: string
): Promise<string | null> {
  // Find the chat for this session
  const chatId = await findChatBySessionKey(sessionKey)

  if (!chatId) {
    console.log("[Messages] No chat found for session:", sessionKey)
    return null
  }

  // Map OpenClaw role to author
  const author = message.role === "assistant" ? "ada" : message.role

  return saveMessage(chatId, author, message.content, {
    runId,
    sessionKey,
    isAutomated: false,
  })
}

/**
 * Get recent messages for a chat
 */
export async function getMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
  try {
    const convex = getConvexClient()
    const result = await convex.query(api.chats.getMessages, {
      chatId: chatId as Id<'chats'>,
      limit,
    })
    return result.messages
  } catch (error) {
    console.error("[Messages] Error getting messages:", error)
    return []
  }
}
