/**
 * OpenClaw HTTP API Client
 * 
 * High-level typed API for OpenClaw gateway operations.
 * Uses the HTTP RPC transport - no WebSocket dependency.
 * 
 * All functions work in both client and server contexts.
 */

import { openclawRpc } from './rpc';
import type {
  Session,
  SessionListResponse,
  SessionListParams,
  SessionPreview,
  SessionType,
} from '@/lib/types';

// Re-export core RPC for advanced use
export { openclawRpc, isOpenClawAvailable, getGatewayStatus } from './rpc';
export type { GatewayStatus } from './rpc';

// ============================================================================
// Session Management
// ============================================================================

function mapSessionKind(kind: string): SessionType {
  switch (kind) {
    case 'main':
      return 'main';
    case 'isolated':
      return 'isolated';
    case 'subagent':
      return 'subagent';
    default:
      return 'main';
  }
}

/**
 * List all sessions from OpenClaw.
 * 
 * @param params - Filter/limit params (optional)
 * @returns List of sessions with metadata
 */
export async function listSessions(
  params?: SessionListParams
): Promise<SessionListResponse> {
  const response = await openclawRpc<{
    sessions: Array<{
      key: string;
      kind?: string;
      model?: string;
      status?: string;
      updatedAt?: string;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    }>;
  }>('sessions.list', (params || {}) as Record<string, unknown>);

  const sessions = (response.sessions || []).map((s) => ({
    id: s.key,
    name: s.key?.split(':').pop() || 'unknown',
    type: mapSessionKind(s.kind || 'main'),
    model: s.model || 'unknown',
    status: 'idle' as const,
    updatedAt: s.updatedAt || new Date().toISOString(),
    createdAt: s.updatedAt || new Date().toISOString(),
    tokens: {
      input: s.inputTokens || 0,
      output: s.outputTokens || 0,
      total: s.totalTokens || 0,
    },
  }));

  return { sessions, total: sessions.length };
}

/**
 * List sessions with effective model extracted from recent messages.
 * This queries message previews to determine the actual model being used.
 */
export async function listSessionsWithEffectiveModel(
  params?: SessionListParams
): Promise<SessionListResponse> {
  const response = await openclawRpc<{
    sessions: Array<{
      key: string;
      kind?: string;
      model?: string;
      updatedAt?: string;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    }>;
  }>('sessions.list', (params || {}) as Record<string, unknown>);

  const sessionRows = response.sessions || [];
  const sessionKeys = sessionRows.map((s) => s.key);

  // Fetch previews to get actual model from messages
  let previewData: {
    previews?: Array<{
      key: string;
      items?: Array<{ role?: string; model?: string }>;
    }>;
  } = {};

  if (sessionKeys.length > 0) {
    try {
      previewData = await openclawRpc<{
        previews: Array<{
          key: string;
          items?: Array<{ role?: string; model?: string }>;
        }>;
      }>('sessions.preview', { keys: sessionKeys, limit: 5 });
    } catch (err) {
      console.warn('[OpenClaw API] Failed to fetch session previews:', err);
    }
  }

  // Build a map of session key to effective model from preview messages
  const effectiveModelMap = new Map<string, string>();
  for (const preview of previewData.previews || []) {
    for (const item of preview.items || []) {
      if (item.model) {
        effectiveModelMap.set(preview.key, item.model);
        break;
      }
    }
  }

  // Map sessions with effective model
  const sessions = sessionRows.map((s) => {
    const key = s.key;
    const effectiveModel = effectiveModelMap.get(key);
    const sessionModel = s.model || 'unknown';

    return {
      id: key,
      name: key?.split(':').pop() || 'unknown',
      type: mapSessionKind(s.kind || 'main'),
      model: sessionModel,
      effectiveModel: effectiveModel || sessionModel,
      status: 'idle' as const,
      updatedAt: s.updatedAt || new Date().toISOString(),
      createdAt: s.updatedAt || new Date().toISOString(),
      tokens: {
        input: s.inputTokens || 0,
        output: s.outputTokens || 0,
        total: s.totalTokens || 0,
      },
    };
  });

  return { sessions, total: sessions.length };
}

/**
 * Get model context window size in tokens.
 */
function getModelContextWindow(model: string): number {
  const lowerModel = model.toLowerCase();

  // Anthropic models
  if (lowerModel.includes('claude-opus-4-6')) return 200000;
  if (lowerModel.includes('claude-opus-4-5')) return 200000;
  if (lowerModel.includes('claude-opus')) return 200000;
  if (lowerModel.includes('claude-sonnet-4')) return 200000;
  if (lowerModel.includes('claude-sonnet')) return 200000;
  if (lowerModel.includes('claude-haiku')) return 200000;
  if (lowerModel.includes('claude')) return 200000;

  // Moonshot / Kimi models
  if (lowerModel.includes('kimi-k2-thinking') || lowerModel.includes('kimi-k2.5-thinking'))
    return 131072;
  if (lowerModel.includes('kimi-k2')) return 256000;
  if (lowerModel.includes('kimi-for-coding')) return 262144;
  if (lowerModel.includes('kimi')) return 200000;
  if (lowerModel.includes('moonshot')) return 200000;

  // OpenAI models
  if (lowerModel.includes('gpt-4.5')) return 128000;
  if (lowerModel.includes('gpt-4o')) return 128000;
  if (lowerModel.includes('gpt-4-turbo')) return 128000;
  if (lowerModel.includes('gpt-4')) return 8192;
  if (lowerModel.includes('gpt-3.5-turbo')) return 16385;
  if (lowerModel.includes('gpt-3.5')) return 4096;
  if (lowerModel.includes('gpt-5')) return 128000;

  // Google models
  if (lowerModel.includes('gemini-1.5-pro')) return 2000000;
  if (lowerModel.includes('gemini-1.5-flash')) return 1000000;
  if (lowerModel.includes('gemini-1.5')) return 1000000;
  if (lowerModel.includes('gemini')) return 1000000;

  // Z.AI / GLM models
  if (lowerModel.includes('glm-4.5')) return 128000;
  if (lowerModel.includes('glm-4')) return 128000;
  if (lowerModel.includes('glm')) return 128000;

  // MiniMax models
  if (lowerModel.includes('minimax')) return 1000000;

  // Default fallback for unknown models (assume 128k)
  return 128000;
}

/**
 * Calculate context percentage based on token usage.
 */
function calculateContextPercentage(tokensTotal: number, model: string): number {
  const contextWindow = getModelContextWindow(model);
  const percentage = (tokensTotal / contextWindow) * 100;
  return Math.min(percentage, 100);
}

/**
 * Get session preview with message history.
 * 
 * @param sessionKey - The session key (e.g., 'agent:main')
 * @param limit - Maximum number of messages to return
 * @returns Session metadata and message history
 */
export async function getSessionPreview(
  sessionKey: string,
  limit?: number
): Promise<SessionPreview> {
  type PreviewResponse = {
    ts: number;
    previews: Array<{
      key: string;
      status: 'ok' | 'empty' | 'missing' | 'error';
      items: Array<{ role: string; text: string; model?: string }>;
    }>;
  };

  // Fetch both preview and session list data in parallel
  const [previewResponse, sessionsResponse] = await Promise.all([
    openclawRpc<PreviewResponse>('sessions.preview', {
      keys: [sessionKey],
      limit: limit || 50,
    }),
    openclawRpc<{
      sessions: Array<{
        key: string;
        model?: string;
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
      }>;
    }>('sessions.list', { limit: 100 }),
  ]);

  const previewEntry = previewResponse.previews?.[0];

  if (!previewEntry || previewEntry.status === 'missing') {
    throw new Error(`Session "${sessionKey}" not found`);
  }

  if (previewEntry.status === 'error') {
    throw new Error(`Failed to load session "${sessionKey}"`);
  }

  // Transform items into SessionMessage format
  const messages = previewEntry.items.map((item, index) => {
    const role: 'user' | 'assistant' | 'system' =
      item.role === 'user' || item.role === 'assistant' || item.role === 'system'
        ? item.role
        : 'assistant';
    return {
      id: `${sessionKey}-msg-${index}`,
      role,
      content: item.text,
      timestamp: new Date().toISOString(),
    };
  });

  // Find session data from sessions.list for accurate token counts
  const sessionData = sessionsResponse.sessions?.find((s) => s.key === sessionKey);

  // Determine the model
  const effectiveModel =
    previewEntry.items.find((i) => i.model)?.model ||
    sessionData?.model ||
    'unknown';

  // Get token counts
  const tokensTotal = sessionData?.totalTokens || 0;
  const tokensInput = sessionData?.inputTokens || 0;
  const tokensOutput = sessionData?.outputTokens || 0;

  // Calculate context percentage
  const contextPercentage =
    effectiveModel !== 'unknown'
      ? calculateContextPercentage(tokensTotal, effectiveModel)
      : 0;

  const session: Session = {
    id: sessionKey,
    name: sessionKey.split(':').pop() || sessionKey,
    type: 'main',
    model: effectiveModel,
    status: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tokens: {
      input: tokensInput,
      output: tokensOutput,
      total: tokensTotal,
    },
  };

  return {
    session,
    messages,
    contextPercentage,
  };
}

/**
 * Reset a session (clear all conversation history).
 * 
 * @param sessionKey - The session key to reset
 */
export async function resetSession(sessionKey: string): Promise<void> {
  await openclawRpc<void>('sessions.reset', { sessionKey });
}

/**
 * Compact a session (summarize context to reduce token usage).
 * 
 * @param sessionKey - The session key to compact
 */
export async function compactSession(sessionKey: string): Promise<void> {
  await openclawRpc<void>('sessions.compact', { sessionKey });
}

/**
 * Cancel/abort a running session.
 * 
 * @param sessionKey - The session key to abort
 */
export async function abortSession(sessionKey: string): Promise<void> {
  await openclawRpc<void>('chat.abort', { sessionKey });
}

// Alias for backward compatibility
export { abortSession as cancelSession };

// ============================================================================
// Chat Operations
// ============================================================================

export interface ChatSendResult {
  runId: string;
  status: 'started' | 'queued' | 'error';
}

/**
 * Send a chat message to a session.
 * 
 * @param sessionKey - The target session key (e.g., 'agent:main', 'trap:myproject:chat123')
 * @param message - The message content
 * @returns Promise with runId and status
 */
export async function sendChatMessage(
  sessionKey: string,
  message: string
): Promise<ChatSendResult> {
  const idempotencyKey = generateUUID();

  const result = await openclawRpc<ChatSendResult>('chat.send', {
    sessionKey,
    message,
    idempotencyKey
  });

  return result;
}

/** Generate UUID for idempotency keys */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
