"use client"

import { useState } from "react"

interface RunButtonProps {
  jobId: string
  jobName?: string
  onRun?: (jobId: string) => Promise<void>
  disabled?: boolean
}

export default function RunButton({ jobId, jobName, onRun, disabled = false }: RunButtonProps) {
  const [isRunning, setIsRunning] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    
    if (disabled || isRunning || !onRun) return
    
    try {
      setIsRunning(true)
      await onRun(jobId)
    } catch (error) {
      console.error('Failed to run job:', error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isRunning}
      className={`
        inline-flex items-center px-2 py-1 text-xs font-medium rounded border
        transition-colors duration-150
        ${disabled || isRunning 
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
        }
      `}
      title={disabled ? "Job is disabled" : `Run ${jobName || jobId} now`}
    >
      {isRunning ? (
        <>
          <svg 
            className="w-3 h-3 mr-1 animate-spin" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Running
        </>
      ) : (
        <>
          <svg 
            className="w-3 h-3 mr-1" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z"/>
          </svg>
          Run Now
        </>
      )}
    </button>
  )
}