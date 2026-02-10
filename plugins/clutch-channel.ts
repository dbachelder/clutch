/**
 * Clutch Channel Plugin for OpenClaw
 *
 * Enables bidirectional communication between OpenClaw and the Clutch UI.
 *
 * How it works:
 *   1. Clutch frontend sends messages via OpenClaw WebSocket (chat.send RPC)
 *   2. OpenClaw processes the message in the agent session
 *   3. Plugin tracks agent lifecycle events and updates message delivery status
 *   4. On agent_end, posts assistant responses back to Clutch API → Convex
 *   5. Convex reactive query updates the Clutch UI
 *
 * Session key format: clutch:{projectSlug}:{chatId}
 * 
 * Message correlation strategy:
 *   - When agent events fire, query for the latest human message in the chat
 *   - Update its delivery_status based on agent lifecycle
 *   - This avoids complex message ID tracking across RPC boundaries
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

function getClutchUrl(api: OpenClawPluginApi): string {
  return api.config.env?.CLUTCH_URL || api.config.env?.CLUTCH_API_URL || "http://localhost:3002";
}

/**
 * Parse a clutch session key into its components.
 * Format: clutch:{projectSlug}:{chatId}
 */
function parseClutchSessionKey(sessionKey: string): { projectSlug: string; chatId: string } | null {
  const match = sessionKey.match(/^clutch:([^:]+):(.+)$/);
  if (!match) return null;
  return { projectSlug: match[1], chatId: match[2] };
}

/**
 * Extract text content from an agent message.
 * Handles both string content and structured content arrays.
 */
function extractTextContent(message: unknown): string {
  if (!message || typeof message !== "object") return "";

  const msg = message as Record<string, unknown>;
  const content = msg.content;

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .filter(
        (c): c is { type: string; text: string } =>
          c && typeof c === "object" && c.type === "text" && typeof c.text === "string"
      )
      .map((c) => c.text)
      .join("\n\n");
  }

  return "";
}

/**
 * Update message delivery status in Clutch
 */
async function updateMessageStatus(
  api: OpenClawPluginApi,
  chatId: string,
  messageId: string,
  status: "sent" | "delivered" | "processing" | "responded" | "failed"
): Promise<{ ok: boolean; error?: string }> {
  const clutchUrl = getClutchUrl(api);

  try {
    const response = await fetch(`${clutchUrl}/api/chats/${chatId}/messages/${messageId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivery_status: status }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${error}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

/**
 * Get the latest human message from a chat (for status updates)
 */
async function getLatestHumanMessage(
  api: OpenClawPluginApi,
  chatId: string
): Promise<{ id: string; delivery_status?: string } | null> {
  const clutchUrl = getClutchUrl(api);

  try {
    // Use the Convex query through the API
    const response = await fetch(`${clutchUrl}/api/chats/${chatId}/latest-human-message`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      api.logger.warn(`Clutch: failed to get latest human message for chat ${chatId}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    api.logger.warn(`Clutch: error getting latest human message for chat ${chatId}: ${error}`);
    return null;
  }
}

async function sendToClutch(
  api: OpenClawPluginApi,
  chatId: string,
  content: string,
  options?: {
    runId?: string;
    sessionKey?: string;
    mediaUrl?: string;
    isAutomated?: boolean;
  }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const clutchUrl = getClutchUrl(api);
  const { runId, sessionKey, mediaUrl, isAutomated } = options || {};

  try {
    const body: Record<string, unknown> = {
      author: "ada",
      content: mediaUrl ? `${content}\n\n📎 ${mediaUrl}` : content,
      is_automated: isAutomated ?? false,
    };

    if (runId) body.run_id = runId;
    if (sessionKey) body.session_key = sessionKey;

    const response = await fetch(`${clutchUrl}/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 409) {
      // Duplicate run_id — message already saved (e.g. by frontend polling)
      api.logger.info(`Clutch: message already saved (duplicate run_id: ${runId})`);
      return { ok: true };
    }

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error };
    }

    const data = await response.json();
    return { ok: true, messageId: data.message?.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send to Clutch",
    };
  }
}

/**
 * Handle resilience after gateway restart - find stuck messages and mark as failed
 */
async function handleRestartResilience(api: OpenClawPluginApi): Promise<void> {
  const clutchUrl = getClutchUrl(api);

  try {
    // Get messages stuck in "sent" or "delivered" status
    const response = await fetch(`${clutchUrl}/api/chats/messages/stuck`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      api.logger.warn(`Clutch: could not check for stuck messages: HTTP ${response.status}`);
      return;
    }

    const data = await response.json();
    const stuckMessages = data.messages || [];

    for (const msg of stuckMessages) {
      // Mark messages older than 5 minutes as failed
      const age = Date.now() - msg.created_at;
      if (age > 5 * 60 * 1000) { // 5 minutes
        api.logger.info(`Clutch: marking stuck message ${msg.id} as failed (age: ${Math.round(age/1000)}s)`);
        await updateMessageStatus(api, msg.chat_id, msg.id, "failed");
      }
    }
  } catch (error) {
    api.logger.warn(`Clutch: error during restart resilience check: ${error}`);
  }
}

export default function register(api: OpenClawPluginApi) {
  // =========================================================================
  // Plugin initialization - handle restart resilience  
  // =========================================================================
  api.logger.info("Clutch channel plugin loading...");
  
  // Handle stuck messages after restart
  setTimeout(() => handleRestartResilience(api), 2000);

  // =========================================================================
  // message_received hook — update latest human message to "delivered"
  // =========================================================================
  api.on("message_received", async (event, ctx) => {
    const sessionKey = ctx.sessionKey;
    if (!sessionKey) return;

    const parsed = parseClutchSessionKey(sessionKey);
    if (!parsed) return;

    const { chatId } = parsed;

    // Find the latest human message in this chat and mark as delivered
    const latestMessage = await getLatestHumanMessage(api, chatId);
    
    if (latestMessage && latestMessage.delivery_status === "sent") {
      api.logger.info(`Clutch: marking message ${latestMessage.id} as delivered`);
      const result = await updateMessageStatus(api, chatId, latestMessage.id, "delivered");
      
      if (!result.ok) {
        api.logger.warn(`Clutch: failed to mark message ${latestMessage.id} as delivered: ${result.error}`);
      }
    }
  });

  // =========================================================================
  // agent_start hook — update to "processing"
  // =========================================================================
  api.on("agent_start", async (event, ctx) => {
    const sessionKey = ctx.sessionKey;
    if (!sessionKey) return;

    const parsed = parseClutchSessionKey(sessionKey);
    if (!parsed) return;

    const { chatId } = parsed;

    // Find the latest human message in this chat and mark as processing
    const latestMessage = await getLatestHumanMessage(api, chatId);
    
    if (latestMessage && (latestMessage.delivery_status === "delivered" || latestMessage.delivery_status === "sent")) {
      api.logger.info(`Clutch: marking message ${latestMessage.id} as processing`);
      const result = await updateMessageStatus(api, chatId, latestMessage.id, "processing");
      
      if (!result.ok) {
        api.logger.warn(`Clutch: failed to mark message ${latestMessage.id} as processing: ${result.error}`);
      }
    }
  });

  // =========================================================================
  // agent_end hook — persist assistant responses and update to "responded"/"failed"
  // =========================================================================
  api.on("agent_end", async (event, ctx) => {
    const sessionKey = ctx.sessionKey;
    if (!sessionKey) return;

    // Only handle clutch:* sessions
    const parsed = parseClutchSessionKey(sessionKey);
    if (!parsed) return;

    const { chatId } = parsed;

    // Get the latest human message for status update
    const latestMessage = await getLatestHumanMessage(api, chatId);

    if (!event.success) {
      api.logger.warn(`Clutch: agent_end failed for chat ${chatId}: ${event.error}`);
      
      // Mark original message as failed if we found it
      if (latestMessage) {
        await updateMessageStatus(api, chatId, latestMessage.id, "failed");
      }

      // Still clear typing indicator even on failure/abort
      const clutchUrl = getClutchUrl(api);
      try {
        await fetch(`${clutchUrl}/api/chats/${chatId}/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typing: false, author: "ada" }),
        });
      } catch (error) {
        api.logger.warn(`Clutch: failed to clear typing after abort for chat ${chatId}: ${error}`);
      }
      return;
    }

    // Find the last assistant message in the transcript
    const messages = event.messages || [];
    let lastAssistantContent = "";

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as Record<string, unknown>;
      if (msg?.role === "assistant") {
        lastAssistantContent = extractTextContent(msg);
        break;
      }
    }

    const trimmed = lastAssistantContent.trim();
    if (!trimmed || trimmed === "NO_REPLY" || trimmed === "HEARTBEAT_OK") {
      api.logger.info(`Clutch: no assistant content to save for chat ${chatId}`);
      
      // Mark as responded even with no content  
      if (latestMessage) {
        await updateMessageStatus(api, chatId, latestMessage.id, "responded");
      }

      // Still clear typing indicator
      const clutchUrl2 = getClutchUrl(api);
      try {
        await fetch(`${clutchUrl2}/api/chats/${chatId}/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typing: false, author: "ada" }),
        });
      } catch {
        /* ignore */
      }
      return;
    }

    // POST the response to Clutch API → Convex
    api.logger.info(
      `Clutch: saving assistant response to chat ${chatId} (${lastAssistantContent.length} chars)`
    );
    const result = await sendToClutch(api, chatId, lastAssistantContent.trim(), {
      sessionKey,
      isAutomated: false,
    });

    if (result.ok) {
      api.logger.info(`Clutch: response saved to chat ${chatId}`);
      
      // Mark original message as responded
      if (latestMessage) {
        await updateMessageStatus(api, chatId, latestMessage.id, "responded");
      }
    } else {
      api.logger.warn(`Clutch: failed to save response to chat ${chatId}: ${result.error}`);
      
      // Mark original message as failed
      if (latestMessage) {
        await updateMessageStatus(api, chatId, latestMessage.id, "failed");
      }
    }

    // Clear typing indicator after response is saved
    const clutchUrl = getClutchUrl(api);
    try {
      await fetch(`${clutchUrl}/api/chats/${chatId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing: false, author: "ada" }),
      });
    } catch (error) {
      api.logger.warn(`Clutch: failed to clear typing indicator for chat ${chatId}: ${error}`);
    }
  });

  // =========================================================================
  // Channel registration (for outbound messaging via message tool)
  // =========================================================================
  api.registerChannel({
    plugin: {
      id: "clutch",
      meta: {
        id: "clutch",
        label: "OpenClutch",
        selectionLabel: "OpenClutch",
        detailLabel: "OpenClutch Orchestration",
        docsPath: "/channels/clutch",
        blurb: "AI agent orchestration UI",
        order: 50,
      },
      capabilities: {
        chatTypes: ["direct", "group"],
      },
      config: {
        listAccountIds: () => ["default"],
        resolveAccount: () => ({ accountId: "default", valid: true }),
      },
      outbound: {
        deliveryMode: "direct",

        sendTypingIndicator: async (ctx) => {
          const { to, isTyping } = ctx;
          if (!to) return { ok: false, error: "No chat ID (to) provided" };

          const clutchUrl = getClutchUrl(api);
          try {
            const response = await fetch(`${clutchUrl}/api/chats/${to}/typing`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ typing: isTyping, author: "ada" }),
            });
            if (!response.ok) {
              api.logger.warn(`Clutch: typing indicator failed - ${response.status}`);
              return { ok: false, error: `HTTP ${response.status}` };
            }
            return { ok: true };
          } catch (error) {
            api.logger.warn(`Clutch: typing indicator error - ${error}`);
            return {
              ok: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        },

        sendText: async (ctx) => {
          const { to, text } = ctx;
          if (!to) return { ok: false, error: "No chat ID (to) provided" };

          api.logger.info(`Clutch: sendText to chat ${to}`);
          const result = await sendToClutch(api, to, text);
          if (!result.ok) api.logger.warn(`Clutch: sendText failed - ${result.error}`);
          return {
            ok: result.ok,
            messageId: result.messageId,
            error: result.error ? new Error(result.error) : undefined,
          };
        },

        sendMedia: async (ctx) => {
          const { to, text, mediaUrl } = ctx;
          if (!to) return { ok: false, error: "No chat ID (to) provided" };

          api.logger.info(`Clutch: sendMedia to chat ${to}`);
          const result = await sendToClutch(api, to, text || "📎 Attachment", { mediaUrl });
          if (!result.ok) api.logger.warn(`Clutch: sendMedia failed - ${result.error}`);
          return {
            ok: result.ok,
            messageId: result.messageId,
            error: result.error ? new Error(result.error) : undefined,
          };
        },
      },
    },
  });

  api.logger.info("Clutch channel plugin loaded with delivery status tracking");
}