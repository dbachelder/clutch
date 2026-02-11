'use client';

/**
 * Session Detail Page
 * View detailed information about a specific session
 * Uses HTTP API instead of WebSocket
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RotateCcw, Archive, AlertCircle, X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/hooks/use-session';
import { useOpenClawHttpRpc } from '@/lib/hooks/use-openclaw-http';
import type { SessionMessage } from '@/lib/types/session';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  // Safely decode session ID, handling multiple encoding levels and special characters
  const sessionId = (() => {
    const rawId = params.id as string;
    try {
      // Handle double-encoded URLs and ensure proper decoding
      let decoded = decodeURIComponent(rawId);
      // If it looks like it might be double-encoded, try again
      if (decoded.includes('%')) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          // If second decode fails, use the first result
        }
      }
      return decoded;
    } catch (error) {
      console.error('[SessionDetail] Failed to decode session ID:', rawId, error);
      // Fallback to raw ID if decoding fails
      return rawId;
    }
  })();
  
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[] | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Simple toast function
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };
  
  // Session metadata from Convex (reactive, real-time)
  const { session: convexSession, isLoading: convexLoading } = useSession(sessionId);
  const { getSessionPreview, resetSession, compactSession, cancelSession } = useOpenClawHttpRpc();

  // Load message history via RPC
  const loadMessages = async () => {
    if (!sessionId) return;
    
    try {
      setMessagesLoading(true);
      setMessagesError(null);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000);
      });
      
      const dataPromise = getSessionPreview(sessionId);
      const preview = await Promise.race([dataPromise, timeoutPromise]);
      
      setMessages(preview.messages);
      setMessagesError(null);
    } catch (error) {
      console.error('Failed to load message history:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessagesError(errorMessage);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Load messages on mount
  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Handle session reset
  const handleResetSession = async () => {
    try {
      setIsResetting(true);
      setShowResetDialog(false);
      await resetSession(sessionId);
      showToast("Session has been reset successfully", "success");
      await loadMessages();
    } catch (error) {
      console.error('Failed to reset session:', error);
      showToast("Failed to reset session", "error");
    } finally {
      setIsResetting(false);
    }
  };

  // Handle session compact
  const handleCompactSession = async () => {
    try {
      setIsCompacting(true);
      await compactSession(sessionId);
      showToast("Session context has been compacted successfully", "success");
      await loadMessages();
    } catch (error) {
      console.error('Failed to compact session:', error);
      showToast("Failed to compact session context", "error");
    } finally {
      setIsCompacting(false);
    }
  };

  // Handle session cancel
  const handleCancelSession = async () => {
    try {
      setIsCanceling(true);
      await cancelSession(sessionId);
      showToast("Session has been canceled successfully", "success");
      await loadMessages();
    } catch (error) {
      console.error('Failed to cancel session:', error);
      showToast("Failed to cancel session", "error");
    } finally {
      setIsCanceling(false);
    }
  };

  // Show loading only when both Convex and messages are still loading
  if (convexLoading && messagesLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-muted-foreground text-center">
          Loading session details...
        </p>
      </div>
    );
  }

  // Session not found in Convex (after loading completes)
  if (!convexLoading && !convexSession) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => router.push('/sessions')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sessions
        </Button>
        <div className="rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Session Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The session you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button variant="outline" onClick={() => router.push('/sessions')}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  const displaySession = convexSession;

  // Compute context percentage from real token data
  const contextPercentage = displaySession?.model && displaySession.tokens_total
    ? (() => {
        const model = displaySession.model;
        const lowerModel = model.toLowerCase();
        let contextWindow = 128000; // default
        if (lowerModel.includes('claude')) contextWindow = 200000;
        else if (lowerModel.includes('kimi-k2')) contextWindow = 256000;
        else if (lowerModel.includes('kimi-for-coding')) contextWindow = 262144;
        else if (lowerModel.includes('kimi')) contextWindow = 200000;
        else if (lowerModel.includes('gemini')) contextWindow = 1000000;
        else if (lowerModel.includes('gpt-5')) contextWindow = 128000;
        else if (lowerModel.includes('gpt-4o') || lowerModel.includes('gpt-4-turbo')) contextWindow = 128000;
        else if (lowerModel.includes('glm')) contextWindow = 128000;
        return Math.min((displaySession.tokens_total / contextWindow) * 100, 100);
      })()
    : null;

  return (
    <div className="container mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => router.push('/sessions')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Sessions
      </Button>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold">{displaySession?.session_key.split(':').pop() || sessionId}</h1>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Cancel Button - only show if session appears to be running */}
            {displaySession?.status !== 'idle' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelSession}
                disabled={isCanceling}
                title="Cancel running session"
              >
                {isCanceling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Cancel
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompactSession}
              disabled={isCompacting}
            >
              {isCompacting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Compact Context
            </Button>
            
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Reset Session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Session</DialogTitle>
                  <DialogDescription>
                    This will permanently clear all conversation history for this session. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleResetSession}>
                    Reset Session
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Session Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <div className="text-sm text-muted-foreground">Model</div>
            <div className="font-medium">{displaySession?.model || 'unknown'}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Tokens</div>
            <div className="font-medium">{(displaySession?.tokens_total ?? 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Context Usage</div>
            <div className="font-medium">
              {contextPercentage !== null
                ? `${contextPercentage.toFixed(1)}%`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Last Updated</div>
            <div className="font-medium">
              {displaySession?.updated_at 
                ? new Date(displaySession.updated_at).toLocaleString()
                : 'Unknown'}
            </div>
          </div>
        </div>

        {/* Additional Session Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-sm text-muted-foreground">Session ID</div>
            <div className="font-mono text-sm">{sessionId}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Type</div>
            <div className="capitalize">{displaySession?.session_type}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="capitalize">{displaySession?.status}</div>
          </div>
        </div>

        {/* Token Usage Breakdown */}
        <div className="border-t pt-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Token Usage Breakdown</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">Input</div>
              <div className="text-2xl font-bold">{(displaySession?.tokens_input ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">Output</div>
              <div className="text-2xl font-bold">{(displaySession?.tokens_output ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{(displaySession?.tokens_total ?? 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Session History */}
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">Conversation History</h2>
          {messagesLoading ? (
            <div className="h-32 w-full rounded-md border flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading conversation history...
            </div>
          ) : messagesError ? (
            <div className="rounded-md border p-6 text-center">
              <p className="text-muted-foreground mb-2">Failed to load messages: {messagesError}</p>
              <Button variant="outline" size="sm" onClick={loadMessages}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="h-96 w-full rounded-md border overflow-y-auto">
              <div className="p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : message.role === 'assistant'
                          ? 'bg-muted'
                          : 'bg-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium capitalize">
                          {message.role}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p className="mb-2">No messages available.</p>
              <p className="text-sm opacity-70">
                Conversation history requires OpenClaw RPC connection. Session metadata is still available.
              </p>
            </div>
          )}
        </div>

        {/* Parent Session Link */}
        {/* Note: Parent session tracking removed in new sessions schema */}

        {/* HTTP API Note */}
        <div className="border-t pt-6 mt-6">
          <div className="flex items-center gap-2 text-blue-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              Using HTTP API for session operations. No WebSocket connection required.
            </span>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
              notification.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <span className="text-sm">{notification.message}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-white hover:text-gray-200"
              onClick={() => setNotification(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
