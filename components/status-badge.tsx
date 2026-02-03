'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export type StatusType = 'active' | 'idle' | 'error' | 'paused'

interface StatusBadgeProps {
  status: StatusType
  children: React.ReactNode
  className?: string
}

const statusStyles = {
  active: 'bg-green-100 text-green-800 border-green-200',
  idle: 'bg-gray-100 text-gray-600 border-gray-200', 
  error: 'bg-red-100 text-red-800 border-red-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200'
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border',
        statusStyles[status],
        className
      )}
      data-testid="status-badge"
      data-status={status}
    >
      <span 
        className="w-2 h-2 rounded-full bg-current opacity-60"
        aria-hidden="true"
      />
      {children}
    </span>
  )
}