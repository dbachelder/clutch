"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, ChevronUp, Info, Bot, Timer, Cpu, Clock, Activity, Wifi, WifiOff, ExternalLink, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface SubAgentDetails {
  key: string
  label?: string
  model?: string
  status?: string
  agentId?: string
  createdAt?: number
  updatedAt?: number
  runtime?: string
  isCron?: boolean
  totalTokens?: number
  contextTokens?: number
  taskTitle?: string
  taskId?: string
  projectSlug?: string
}

interface SessionInfoDropdownProps {
  sessionKey: string
  sessionInfo?: {
    model?: string
    contextPercent?: number
  }
  connected: boolean
  activeSubagents: SubAgentDetails[]
  activeCrons: SubAgentDetails[]
  gatewayStatus?: {
    startedAt?: string
    uptime?: number
    version?: string
    uptimeString?: string
  }
  className?: string
}

// Get context window size for a model
function getModelContextWindow(model?: string): number {
  if (!model) return 128000
  const lowerModel = model.toLowerCase()

  // Anthropic models
  if (lowerModel.includes('claude-opus-4-6')) return 200000
  if (lowerModel.includes('claude-opus-4-5')) return 200000
  if (lowerModel.includes('claude-opus')) return 200000
  if (lowerModel.includes('claude-sonnet-4')) return 200000
  if (lowerModel.includes('claude-sonnet')) return 200000
  if (lowerModel.includes('claude-haiku')) return 200000
  if (lowerModel.includes('claude')) return 200000

  // Moonshot / Kimi models
  if (lowerModel.includes('kimi-k2-thinking') || lowerModel.includes('kimi-k2.5-thinking'))
    return 131072
  if (lowerModel.includes('kimi-k2')) return 256000
  if (lowerModel.includes('kimi-for-coding')) return 262144
  if (lowerModel.includes('kimi')) return 200000
  if (lowerModel.includes('moonshot')) return 200000

  // OpenAI models
  if (lowerModel.includes('gpt-4.5')) return 128000
  if (lowerModel.includes('gpt-4o')) return 128000
  if (lowerModel.includes('gpt-4-turbo')) return 128000
  if (lowerModel.includes('gpt-4')) return 8192
  if (lowerModel.includes('gpt-3.5-turbo')) return 16385

  // Google models
  if (lowerModel.includes('gemini-1.5-pro')) return 2000000
  if (lowerModel.includes('gemini-1.5-flash')) return 1000000
  if (lowerModel.includes('gemini')) return 1000000

  // Z.AI / GLM models
  if (lowerModel.includes('glm-4')) return 128000

  // Default fallback
  return 128000
}

// Calculate context percentage
function calculateContextPercentage(totalTokens: number, model: string): number {
  const contextWindow = getModelContextWindow(model)
  return Math.min(Math.round((totalTokens / contextWindow) * 100), 100)
}

// Format last output time with color coding
function formatLastOutput(updatedAt?: number): { text: string; color: string; isStuck: boolean } {
  if (!updatedAt) {
    return { text: "unknown", color: "text-gray-400", isStuck: false }
  }

  const now = Date.now()
  const diffMs = now - updatedAt
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffMinutes < 1) {
    return { 
      text: diffSeconds < 10 ? "just now" : `${diffSeconds}s ago`, 
      color: "text-green-400", 
      isStuck: false 
    }
  } else if (diffMinutes < 5) {
    return { 
      text: `${diffMinutes}m ago`, 
      color: "text-yellow-400", 
      isStuck: false 
    }
  } else {
    return { 
      text: `idle ${diffMinutes}m`, 
      color: "text-red-400", 
      isStuck: true 
    }
  }
}

// Format token count for display
function formatTokenCount(count?: number): string {
  if (!count) return "0"
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

export function SessionInfoDropdown({
  sessionKey,
  sessionInfo,
  connected,
  activeSubagents,
  activeCrons,
  gatewayStatus,
  className = "",
}: SessionInfoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Format model for display (show short name)
  const formatModel = (model?: string) => {
    if (!model) return 'Unknown'
    
    // Extract short names from common model formats
    if (model.includes('claude')) {
      if (model.includes('haiku')) return 'Haiku'
      if (model.includes('sonnet')) return 'Sonnet'
      if (model.includes('opus')) return 'Opus'
      return 'Claude'
    }
    if (model.includes('kimi')) return 'Kimi'
    if (model.includes('moonshot')) return 'Moonshot'
    if (model.includes('gpt')) return 'GPT'
    
    // Fallback to last part of model name
    const parts = model.split('/')
    return parts[parts.length - 1] || model
  }

  // Extract short session ID for display
  const getShortSessionId = (key: string) => {
    if (key.startsWith('trap:')) {
      const id = key.substring(5) // Remove 'trap:' prefix
      return id.substring(0, 8) // Show first 8 characters
    }
    return key.substring(0, 8)
  }

  const hasActiveItems = activeSubagents.length > 0 || activeCrons.length > 0

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-auto px-2 py-1 gap-1.5 text-xs hover:bg-[var(--bg-tertiary)] ${className}`}
      >
        {/* Main indicator */}
        <div className="flex items-center gap-1.5">
          {/* Connection status */}
          {connected ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-yellow-500" />
          )}
          
          {/* Session info */}
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3 text-blue-400" />
            <span className="font-mono text-blue-400">
              {getShortSessionId(sessionKey)}
            </span>
          </div>

          {/* Active indicators */}
          {hasActiveItems && (
            <div className="flex items-center gap-1">
              {activeSubagents.length > 0 && (
                <div className="flex items-center gap-0.5">
                  <Bot className="h-3 w-3 text-purple-400 animate-pulse" />
                  <span className="text-purple-400">{activeSubagents.length}</span>
                </div>
              )}
              {activeCrons.length > 0 && (
                <div className="flex items-center gap-0.5">
                  <Timer className="h-3 w-3 text-orange-400" />
                  <span className="text-orange-400">{activeCrons.length}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Expand indicator */}
          {isOpen ? (
            <ChevronUp className="h-3 w-3 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
          )}
        </div>
      </Button>

      {/* Custom dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Session Details */}
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-400" />
              <span className="font-medium">Session Details</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Status:</span>
                <div className="flex items-center gap-1">
                  {connected ? (
                    <>
                      <Wifi className="h-3 w-3 text-green-500" />
                      <span className="text-sm text-green-500">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-yellow-500" />
                      <span className="text-sm text-yellow-500">Connecting...</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Session ID:</span>
                <Link 
                  href={`/sessions/${sessionKey}`}
                  className="text-sm font-mono text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                >
                  {sessionKey}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {sessionInfo?.model && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Model:</span>
                  <Badge variant="outline" className="text-xs">
                    {formatModel(sessionInfo.model)}
                  </Badge>
                </div>
              )}

              {sessionInfo?.contextPercent !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Context:</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {sessionInfo.contextPercent}%
                  </span>
                </div>
              )}

              {gatewayStatus?.uptimeString && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">OpenClaw:</span>
                  <span className="text-sm text-green-400">
                    {gatewayStatus.uptimeString}
                  </span>
                </div>
              )}

              {gatewayStatus?.version && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Version:</span>
                  <span className="text-sm text-blue-400">
                    {gatewayStatus.version}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sub-Agents */}
          {activeSubagents.length > 0 && (
            <div className="px-3 py-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-purple-400" />
                <span className="font-medium">Active Sub-Agents ({activeSubagents.length})</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-3">
                {activeSubagents.map((agent) => {
                  const lastOutput = formatLastOutput(agent.updatedAt)
                  const contextPercent = agent.model && agent.totalTokens 
                    ? calculateContextPercentage(agent.totalTokens, agent.model)
                    : 0
                  
                  return (
                    <div key={agent.key} className="px-2 py-2 rounded bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-tertiary)] transition-colors">
                      <div className="space-y-1.5">
                        {/* Header: icon + label/task title */}
                        <div className="flex items-start gap-2">
                          <Bot className="h-3.5 w-3.5 text-purple-300 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            {agent.taskTitle ? (
                              <Link 
                                href={agent.projectSlug ? `/projects/${agent.projectSlug}/board?task=${agent.taskId}` : '#'}
                                className="font-medium text-sm text-[var(--text-primary)] hover:text-[var(--accent-blue)] truncate block"
                                title={agent.taskTitle}
                              >
                                {agent.taskTitle}
                              </Link>
                            ) : (
                              <span className="font-medium text-sm truncate block" title={agent.label || agent.key}>
                                {agent.label || getShortSessionId(agent.key)}
                              </span>
                            )}
                          </div>
                          {lastOutput.isStuck && (
                            <span title="Possibly stuck">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        
                        {/* Details row */}
                        <div className="ml-5 space-y-1">
                          {/* Model + Runtime + Tokens */}
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            {agent.model && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-auto">
                                {formatModel(agent.model)}
                              </Badge>
                            )}
                            {agent.runtime && (
                              <span className="text-[var(--text-muted)]">
                                {agent.runtime}
                              </span>
                            )}
                            {agent.totalTokens !== undefined && (
                              <span className="text-[var(--text-muted)]">
                                {formatTokenCount(agent.totalTokens)} tokens
                                {contextPercent > 0 && (
                                  <span className="text-[var(--text-muted)]/70"> ({contextPercent}%)</span>
                                )}
                              </span>
                            )}
                          </div>
                          
                          {/* Last output with color coding */}
                          <div className={`flex items-center gap-1.5 text-xs ${lastOutput.color}`}>
                            <Activity className="h-3 w-3 flex-shrink-0" />
                            <span>{lastOutput.isStuck ? '⚠️ ' : ''}{lastOutput.text}</span>
                            {lastOutput.isStuck && (
                              <span className="text-red-400/80 text-[10px]">— possibly stuck</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cron Jobs */}
          {activeCrons.length > 0 && (
            <div className="px-3 py-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4 text-orange-400" />
                <span className="font-medium">Active Cron Jobs ({activeCrons.length})</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {activeCrons.map((cron) => {
                  const lastOutput = formatLastOutput(cron.updatedAt)
                  
                  return (
                    <div key={cron.key} className="px-2 py-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Timer className="h-3 w-3 text-orange-300 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {cron.label || cron.key}
                          </span>
                        </div>
                        
                        <div className="ml-5 space-y-0.5">
                          {cron.model && (
                            <div className="flex items-center gap-2 text-xs">
                              <Cpu className="h-3 w-3 text-blue-400 flex-shrink-0" />
                              <span>Model: {formatModel(cron.model)}</span>
                            </div>
                          )}
                          
                          {cron.runtime && (
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="h-3 w-3 text-green-400 flex-shrink-0" />
                              <span>Runtime: {cron.runtime}</span>
                            </div>
                          )}
                          
                          <div className={`flex items-center gap-2 text-xs ${lastOutput.color}`}>
                            <Activity className="h-3 w-3 flex-shrink-0" />
                            <span>Last output: {lastOutput.text}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty states */}
          {!hasActiveItems && (
            <div className="px-3 py-2 text-sm text-[var(--text-muted)] text-center">
              No active sub-agents or cron jobs
            </div>
          )}
        </div>
      )}
    </div>
  )
}
