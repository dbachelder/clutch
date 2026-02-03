import { describe, it, expect } from 'vitest'
import { formatBytes, formatDuration, truncateText } from '../format-utils'

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
  })
  
  it('formats bytes less than 1KB', () => {
    expect(formatBytes(512)).toBe('512 Bytes')
    expect(formatBytes(1023)).toBe('1023 Bytes')
  })
  
  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2048)).toBe('2 KB')
  })
  
  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(1572864)).toBe('1.5 MB')
  })
  
  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB')
    expect(formatBytes(2147483648)).toBe('2 GB')
  })
  
  it('respects decimal places', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB')
    expect(formatBytes(1536, 1)).toBe('1.5 KB')
    expect(formatBytes(1536, 3)).toBe('1.500 KB')
  })
})

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(999)).toBe('999ms')
  })
  
  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(5500)).toBe('5s')
    expect(formatDuration(59000)).toBe('59s')
  })
  
  it('formats minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(125000)).toBe('2m 5s')
  })
  
  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3600000)).toBe('1h')
    expect(formatDuration(3660000)).toBe('1h 1m')
    expect(formatDuration(3665000)).toBe('1h 1m 5s')
    expect(formatDuration(7325000)).toBe('2h 2m 5s')
  })
})

describe('truncateText', () => {
  it('returns text unchanged if shorter than max length', () => {
    expect(truncateText('hello', 10)).toBe('hello')
    expect(truncateText('test', 4)).toBe('test')
  })
  
  it('truncates text longer than max length', () => {
    expect(truncateText('hello world', 8)).toBe('hello...')
    expect(truncateText('this is a long text', 10)).toBe('this is...')
  })
  
  it('handles edge cases', () => {
    expect(truncateText('', 5)).toBe('')
    expect(truncateText('abc', 3)).toBe('abc')
    expect(truncateText('abcd', 3)).toBe('...')
  })
  
  it('accounts for ellipsis in max length', () => {
    expect(truncateText('abcdef', 5)).toBe('ab...')
    expect(truncateText('abcdefg', 6)).toBe('abc...')
  })
})