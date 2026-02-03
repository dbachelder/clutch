import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../status-badge'

describe('StatusBadge', () => {
  it('renders children content', () => {
    render(
      <StatusBadge status="active">
        Running
      </StatusBadge>
    )
    
    expect(screen.getByText('Running')).toBeInTheDocument()
  })
  
  it('applies correct status styles', () => {
    const { rerender } = render(
      <StatusBadge status="active">Test</StatusBadge>
    )
    
    let badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'active')
    expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200')
    
    rerender(<StatusBadge status="error">Test</StatusBadge>)
    badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'error')
    expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200')
    
    rerender(<StatusBadge status="idle">Test</StatusBadge>)
    badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'idle')
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-600', 'border-gray-200')
    
    rerender(<StatusBadge status="paused">Test</StatusBadge>)
    badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'paused')
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200')
  })
  
  it('includes status indicator dot', () => {
    render(
      <StatusBadge status="active">
        Running
      </StatusBadge>
    )
    
    const badge = screen.getByTestId('status-badge')
    const dot = badge.querySelector('span[aria-hidden="true"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveClass('w-2', 'h-2', 'rounded-full', 'bg-current')
  })
  
  it('applies additional className', () => {
    render(
      <StatusBadge status="active" className="custom-class">
        Test
      </StatusBadge>
    )
    
    expect(screen.getByTestId('status-badge')).toHaveClass('custom-class')
  })
  
  it('applies base styling classes', () => {
    render(
      <StatusBadge status="active">Test</StatusBadge>
    )
    
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center', 
      'gap-1.5',
      'px-2.5',
      'py-0.5',
      'rounded-md',
      'text-xs',
      'font-medium',
      'border'
    )
  })
})