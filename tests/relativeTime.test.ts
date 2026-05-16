import { describe, expect, it } from 'vitest'

import { daysSince, relativeTime } from '../src/format/relativeTime.ts'

const NOW = Date.parse('2026-05-16T12:00:00Z')

describe('relativeTime', () => {
  it('shows seconds for fresh timestamps', () => {
    expect(relativeTime('2026-05-16T11:59:48Z', NOW)).toBe('12s ago')
  })
  it('shows minutes', () => {
    expect(relativeTime('2026-05-16T11:57:00Z', NOW)).toBe('3m ago')
  })
  it('shows hours', () => {
    expect(relativeTime('2026-05-16T09:00:00Z', NOW)).toBe('3h ago')
  })
  it('shows days', () => {
    expect(relativeTime('2026-05-12T12:00:00Z', NOW)).toBe('4d ago')
  })
  it('shows months when >=30 days old', () => {
    expect(relativeTime('2026-03-16T12:00:00Z', NOW)).toBe('2mo ago')
  })
  it('shows years when >=12 months old', () => {
    expect(relativeTime('2024-05-16T12:00:00Z', NOW)).toBe('2y ago')
  })
  it('returns ? for invalid input', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('?')
  })
})

describe('daysSince', () => {
  it('counts whole days', () => {
    expect(daysSince('2026-05-09T12:00:00Z', NOW)).toBe(7)
  })
})
