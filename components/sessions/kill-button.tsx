'use client'

import { useState } from 'react'
import { Session } from '@/lib/types'
import { killSession } from '@/lib/openclaw-client'
import ConfirmationDialog from './confirmation-dialog'

interface KillButtonProps {
  session: Session
  onSessionKilled: () => void
  variant?: 'compact' | 'danger' | 'default'
}

export default function KillButton({ session, onSessionKilled, variant = 'default' }: KillButtonProps) {
  const [isKilling, setIsKilling] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleKillClick = () => {
    setError(null)
    setShowConfirmation(true)
  }

  const handleConfirmKill = async () => {
    setShowConfirmation(false)
    setIsKilling(true)
    setError(null)

    try {
      const result = await killSession({ sessionKey: session.key })
      
      if (result.success) {
        // Optimistic UI update - session will disappear immediately
        onSessionKilled()
      } else {
        setError(result.error || 'Failed to kill session')
        setIsKilling(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setIsKilling(false)
    }
  }

  const handleCancelKill = () => {
    setShowConfirmation(false)
    setError(null)
  }

  const getButtonClasses = () => {
    const baseClasses = "inline-flex items-center border font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    
    switch (variant) {
      case 'compact':
        return `${baseClasses} px-2.5 py-1.5 text-xs border-red-300 text-red-700 bg-white hover:bg-red-50 focus:ring-red-500`
      
      case 'danger':
        return `${baseClasses} px-4 py-2 text-sm border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500`
      
      default:
        return `${baseClasses} px-3 py-2 text-sm border-red-300 text-red-700 bg-white hover:bg-red-50 focus:ring-red-500`
    }
  }

  const getButtonText = () => {
    if (isKilling) return variant === 'compact' ? 'Killing...' : 'Killing Session...'
    return variant === 'compact' ? 'Kill' : 'Kill Session'
  }

  const getErrorDisplay = () => {
    if (!error) return null
    
    return (
      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleKillClick}
        disabled={isKilling}
        className={getButtonClasses()}
        title={`Kill session ${session.label || session.key}`}
      >
        {isKilling && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {getButtonText()}
      </button>
      
      {getErrorDisplay()}
      
      <ConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={handleConfirmKill}
        onCancel={handleCancelKill}
        title="Kill Session"
        message={`Are you sure you want to kill session "${session.label || session.key}"? This action cannot be undone.`}
        confirmText="Kill Session"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}