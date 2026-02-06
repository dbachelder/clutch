"use client"

import { useState, useEffect } from "react"
import { Draggable } from "@hello-pangea/dnd"
import { Link2, Lock, Bot, AlertTriangle } from "lucide-react"
import type { Task } from "@/lib/types"
import { useSingleSessionStatus } from "@/lib/hooks/use-session-status"
import { useDependencies } from "@/lib/hooks/use-dependencies"
import { formatCompactTime } from "@/lib/utils"

interface TaskCardProps {
  task: Task
  index: number
  onClick: () => void
  isMobile?: boolean
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#52525b",
  medium: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
}

const ROLE_COLORS: Record<string, string> = {
  pm: "#a855f7",
  dev: "#3b82f6",
  qa: "#22c55e",
  research: "#f97316",
  security: "#ef4444",
}

const ROLE_LABELS: Record<string, string> = {
  pm: "PM",
  dev: "Dev",
  qa: "QA",
  research: "Research",
  security: "Sec",
}

const STATUS_COLORS: Record<string, string> = {
  backlog: "#6b7280",
  ready: "#3b82f6",
  in_progress: "#22c55e",
  in_review: "#f97316",
  done: "#22c55e",
}

/**
 * Get color for status age based on duration and status
 */
function getStatusAgeColor(ageMs: number, status: string): string {
  const hours = ageMs / (1000 * 60 * 60)
  
  if (status === 'in_progress' || status === 'in_review') {
    if (hours < 1) return '#22c55e' // green
    if (hours < 4) return '#eab308' // yellow
    return '#ef4444' // red
  }
  
  // For other statuses, use neutral colors
  if (hours < 1) return '#22c55e'
  if (hours < 24) return '#6b7280'
  return '#9ca3af'
}

/**
 * Get color for last output age
 */
function getLastOutputColor(ageMs: number): string {
  const minutes = ageMs / (1000 * 60)
  
  if (minutes < 1) return '#22c55e' // green
  if (minutes < 5) return '#eab308' // yellow
  return '#ef4444' // red
}

/**
 * Format model name for display
 */
function formatModelName(model?: string): string {
  if (!model) return 'agent'
  
  // Extract short name from full model path (e.g., "moonshot/kimi-for-coding" -> "kimi")
  const parts = model.split('/')
  const name = parts[parts.length - 1]
  
  // Shorten common names
  if (name.includes('kimi')) return 'kimi'
  if (name.includes('claude')) return 'claude'
  if (name.includes('gpt')) return 'gpt'
  if (name.includes('gemini')) return 'gemini'
  
  return name.slice(0, 8) // truncate if still long
}

export function TaskCard({ task, index, onClick, isMobile = false }: TaskCardProps) {
  // Track current time for live updates - use lazy initializer to avoid impure function during render
  const [now, setNow] = useState(() => Date.now())

  // Update time every 10 seconds for live display
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Get session status for in-progress tasks
  const shouldFetchSessionStatus = task.status === 'in_progress' && task.session_id
  const { sessionStatus } = useSingleSessionStatus(shouldFetchSessionStatus ? task.session_id || undefined : undefined)

  // Get dependency info
  const { dependencies } = useDependencies(task.id)
  const dependsOnCount = dependencies.depends_on.length
  const blocksCount = dependencies.blocks.length
  const incompleteDeps = dependencies.depends_on.filter(d => d.status !== 'done')
  const isBlocked = incompleteDeps.length > 0

  // Calculate status age
  const statusAge = now - task.updated_at
  const statusAgeColor = getStatusAgeColor(statusAge, task.status)

  // Calculate agent runtime and last output
  const agentRuntime = sessionStatus?.createdAt 
    ? now - new Date(sessionStatus.createdAt).getTime()
    : null
  const lastOutput = sessionStatus?.updatedAt
    ? now - new Date(sessionStatus.updatedAt).getTime()
    : null
  const lastOutputColor = lastOutput ? getLastOutputColor(lastOutput) : null

  // Check if in_progress but no agent attached
  const isOrphaned = task.status === 'in_progress' && (!task.session_id || sessionStatus?.status === 'not_found' || sessionStatus?.status === 'error')

  const tags = (() => {
    if (!task.tags) return []
    try {
      const parsed = JSON.parse(task.tags)
      // Handle double-encoded JSON strings
      if (typeof parsed === 'string') {
        return JSON.parse(parsed) as string[]
      }
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })()
  
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg cursor-pointer transition-all ${
            isMobile ? "p-4 touch-manipulation" : "p-3"
          } ${
            snapshot.isDragging
              ? "shadow-2xl rotate-2 opacity-90 border-[var(--accent-blue)]"
              : "hover:border-[var(--accent-blue)]"
          }`}
        >
          {/* Short ID */}
          <div className="mb-2">
            <span 
              className="text-xs text-[var(--text-muted)] font-mono cursor-pointer hover:text-[var(--accent-blue)] transition-colors select-all"
              title="Click to copy ID"
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(task.id.substring(0, 8))
              }}
            >
              #{task.id.substring(0, 8)}
            </span>
          </div>
          
          {/* Title */}
          <div className="flex items-start gap-2">
            <div 
              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              style={{ backgroundColor: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium }}
              title={`Priority: ${task.priority}`}
            />
            <span className={`text-sm line-clamp-2 flex-1 ${isBlocked ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
              {task.title}
            </span>
          </div>
          
          {/* Status metadata row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
            {/* Status with age */}
            <div className="flex items-center gap-1.5">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[task.status] || '#6b7280' }}
              />
              <span className="text-[var(--text-muted)]">{task.status.replace('_', ' ')}</span>
              <span 
                className="font-medium"
                style={{ color: statusAgeColor }}
                title={`In this status for ${formatCompactTime(task.updated_at)}`}
              >
                {formatCompactTime(task.updated_at)}
              </span>
            </div>

            {/* Agent info for in_progress tasks */}
            {task.status === 'in_progress' && task.session_id && sessionStatus && sessionStatus.status !== 'not_found' && (
              <div className="flex items-center gap-1.5 ml-2 border-l border-[var(--border)] pl-2">
                <Bot className="h-3 w-3 text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">{formatModelName(sessionStatus.model)}</span>
                {agentRuntime !== null && (
                  <span className="text-[var(--text-muted)]">
                    · {formatCompactTime(now - agentRuntime)}
                  </span>
                )}
                {lastOutput !== null && (
                  <span 
                    className="font-medium"
                    style={{ color: lastOutputColor || '#6b7280' }}
                    title="Time since last output"
                  >
                    · out {formatCompactTime(now - lastOutput)}
                  </span>
                )}
              </div>
            )}

            {/* Orphaned agent warning */}
            {isOrphaned && (
              <div 
                className="flex items-center gap-1 ml-2 text-amber-500"
                title="No agent attached to this in-progress task"
              >
                <AlertTriangle className="h-3 w-3" />
                <span>no agent</span>
              </div>
            )}
          </div>
          
          {/* Tags + Assignee */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {tags.slice(0, 2).map((tag) => (
              <span 
                key={tag}
                className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-xs text-[var(--text-muted)]">
                +{tags.length - 2}
              </span>
            )}

            {task.role && task.role !== "any" && (
              <span 
                className="px-1.5 py-0.5 text-xs rounded font-medium text-white"
                style={{ backgroundColor: ROLE_COLORS[task.role] || "#52525b" }}
                title={`Role: ${ROLE_LABELS[task.role] || task.role}`}
              >
                {ROLE_LABELS[task.role] || task.role}
              </span>
            )}

            {task.assignee && (
              <div 
                className="ml-auto w-6 h-6 rounded-full bg-[var(--accent-purple)] flex items-center justify-center text-xs text-white font-medium"
                title={task.assignee}
              >
                {task.assignee.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* Dependency indicators */}
          {(dependsOnCount > 0 || blocksCount > 0) && (
            <div className="mt-2 flex items-center gap-3">
              {dependsOnCount > 0 && (
                <div 
                  className={`flex items-center gap-1 text-xs ${isBlocked ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}
                  title={isBlocked 
                    ? `Blocked by ${incompleteDeps.length} of ${dependsOnCount} task${dependsOnCount > 1 ? 's' : ''}` 
                    : `Depends on ${dependsOnCount} task${dependsOnCount > 1 ? 's' : ''} (all complete)`}
                >
                  {isBlocked ? <Lock className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                  <span>
                    {isBlocked 
                      ? `Blocked by ${incompleteDeps.length}` 
                      : `${dependsOnCount} dep${dependsOnCount > 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
              {blocksCount > 0 && (
                <div 
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)]"
                  title={`Blocks ${blocksCount} task${blocksCount > 1 ? 's' : ''}`}
                >
                  <Link2 className="h-3 w-3 rotate-45" />
                  <span>Blocks {blocksCount}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
