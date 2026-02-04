"use client"

import { Zap } from "lucide-react"

interface StreamingToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export function StreamingToggle({ enabled, onChange }: StreamingToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-2 text-sm px-2 py-1 rounded transition-colors hover:bg-[var(--bg-secondary)]"
      title={`${enabled ? 'Disable' : 'Enable'} streaming responses`}
    >
      <Zap className={`h-4 w-4 ${enabled ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`} />
      <span className={enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
        {enabled ? 'Streaming' : 'No stream'}
      </span>
    </button>
  )
}