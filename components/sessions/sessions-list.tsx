'use client';

/**
 * Sessions List Component
 * Reusable component for displaying sessions with optional project filtering
 * Uses Convex for reactive session data derived from task agent tracking
 * 
 * NOTE: This component was migrated from HTTP API (openclaw sessions CLI)
 * to Convex queries. The sessions are now derived from tasks with agent_session_key.
 */

import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, Activity, Database } from 'lucide-react';
import { SessionTable } from '@/components/sessions/session-table';
import { useAgentSessions, type AgentSession } from '@/lib/hooks/use-agent-sessions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Session, SessionStatus, SessionType } from '@/lib/types';

function ConnectionBadge({ connected }: { connected: boolean }) {
  const status = connected ? 'connected' : 'disconnected';
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default',
    disconnected: 'destructive',
  };

  return (
    <Badge variant={variants[status] || 'outline'} className="flex items-center gap-1">
      <span className="relative flex h-2 w-2">
        {status === 'connected' ? (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        ) : null}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            status === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </span>
      <Database className="h-3 w-3" />
      Convex
    </Badge>
  );
}

export interface SessionsListProps {
  /**
   * Optional project slug to filter sessions for a specific project
   * If provided, only shows sessions related to this project
   */
  projectSlug?: string;

  /**
   * Project ID for Convex queries (required for data fetching)
   */
  projectId?: string;

  /**
   * Custom session navigation for project-scoped sessions
   * If not provided, uses default /sessions/[id] navigation
   */
  onSessionClick?: (sessionId: string) => void;

  /**
   * Whether to show stats cards (total, running, tokens)
   * Defaults to true for home page, can be disabled for project pages
   */
  showStats?: boolean;

  /**
   * Custom title for the sessions list
   * Defaults to "Sessions" if not provided
   */
  title?: string;

  /**
   * Custom description for the sessions list
   */
  description?: string;
}

/**
 * Convert AgentSession (from Convex) to Session (for UI compatibility)
 */
function convertAgentSessionToSession(agentSession: AgentSession): Session {
  return {
    id: agentSession.id,
    name: agentSession.name,
    type: agentSession.type as SessionType,
    model: agentSession.model,
    status: agentSession.status as SessionStatus,
    createdAt: agentSession.createdAt,
    updatedAt: agentSession.updatedAt,
    completedAt: agentSession.completedAt,
    tokens: agentSession.tokens,
    task: agentSession.task,
  };
}

export function SessionsList({
  projectSlug,
  projectId,
  onSessionClick,
  showStats = true,
  title = 'Sessions',
  description,
}: SessionsListProps) {
  const router = useRouter();

  // Fetch agent sessions from Convex (reactive, no polling needed)
  const { sessions: agentSessions, isLoading } = useAgentSessions(projectId || '', 50);

  // Convert to Session type for compatibility with SessionTable
  const sessions: Session[] = agentSessions?.map(convertAgentSessionToSession) ?? [];

  const handleRefresh = () => {
    // Convex data is reactive, but we can force a re-render if needed
    // In practice, this is a no-op since Convex handles reactivity
    router.refresh();
  };

  const handleRowClick = (sessionId: string) => {
    if (onSessionClick) {
      onSessionClick(sessionId);
    } else {
      const encodedSessionId = encodeURIComponent(sessionId);
      router.push(`/sessions/${encodedSessionId}`);
    }
  };

  // Calculate stats from sessions
  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const totalTokens = sessions.reduce((acc, s) => acc + (s.tokens?.total || 0), 0);

  const defaultDescription = projectSlug
    ? `Active agent sessions for the ${projectSlug} project`
    : 'Monitor active agent sessions in real-time';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8" />
            {title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {description || defaultDescription}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionBadge connected={true} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats - only show if showStats is true */}
      {showStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">
              {projectSlug ? 'Project Sessions' : 'Total Sessions'}
            </div>
            <div className="text-2xl font-bold mt-1">{sessions.length}</div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Running</div>
            <div className="text-2xl font-bold mt-1 text-green-600">{runningCount}</div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Total Tokens</div>
            <div className="text-2xl font-bold mt-1">
              {totalTokens >= 1000000
                ? `${(totalTokens / 1000000).toFixed(1)}M`
                : totalTokens >= 1000
                ? `${(totalTokens / 1000).toFixed(1)}K`
                : totalTokens}
            </div>
          </div>
        </div>
      )}

      {/* Session Table */}
      <div className="bg-background rounded-lg">
        <SessionTable
          onRowClick={handleRowClick}
          filteredSessions={sessions}
        />
      </div>

      {/* Footer info */}
      <div className="text-sm text-muted-foreground text-center">
        Click on any session row to view details or navigate to the associated task
      </div>
    </div>
  );
}
