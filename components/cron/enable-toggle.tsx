"use client"

import { useState } from "react"

interface EnableToggleProps {
  jobId: string
  jobName?: string
  enabled: boolean
  onToggle?: (jobId: string, enabled: boolean) => Promise<void>
  disabled?: boolean
}

export default function EnableToggle({ 
  jobId, 
  jobName, 
  enabled, 
  onToggle, 
  disabled = false 
}: EnableToggleProps) {
  const [isToggling, setIsToggling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    
    if (disabled || isToggling || !onToggle) return

    // Show confirmation dialog when disabling
    if (enabled) {
      setShowConfirm(true)
      return
    }

    // Enable directly without confirmation
    await performToggle()
  }

  const performToggle = async () => {
    try {
      setIsToggling(true)
      if (onToggle) {
        await onToggle(jobId, !enabled)
      }
      setShowConfirm(false)
    } catch (error) {
      console.error('Failed to toggle job:', error)
    } finally {
      setIsToggling(false)
    }
  }

  const cancelConfirm = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-xs text-amber-600">Disable job?</span>
        <button
          onClick={performToggle}
          disabled={isToggling}
          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
        >
          {isToggling ? "..." : "Yes"}
        </button>
        <button
          onClick={cancelConfirm}
          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || isToggling}
      className="relative inline-flex items-center h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      style={{
        backgroundColor: disabled ? '#e5e5e5' : enabled ? '#10b981' : '#d1d5db'
      }}
      title={`${enabled ? 'Disable' : 'Enable'} ${jobName || jobId}`}
    >
      <span className="sr-only">
        {enabled ? 'Disable' : 'Enable'} job
      </span>
      <div
        className={`
          inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out
          ${enabled ? 'translate-x-4' : 'translate-x-0'}
          ${isToggling ? 'animate-pulse' : ''}
        `}
      />
    </button>
  )
}