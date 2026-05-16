import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkForUpdate } from '../src/update/checker.ts'

describe('checkForUpdate', () => {
  const originalEnv = process.env.NO_UPDATE_NOTIFIER

  beforeEach(() => {
    delete process.env.NO_UPDATE_NOTIFIER
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NO_UPDATE_NOTIFIER
    } else {
      process.env.NO_UPDATE_NOTIFIER = originalEnv
    }
    vi.restoreAllMocks()
  })

  it('returns null when NO_UPDATE_NOTIFIER is set', () => {
    process.env.NO_UPDATE_NOTIFIER = '1'
    const result = checkForUpdate({ name: '@northern-information/pr-dashboard', version: '0.1.4' })
    expect(result).toBeNull()
  })

  it('returns null on the first run (no cached result yet)', () => {
    // First call only schedules a background check; .update is undefined.
    // Use a throwaway package name to avoid colliding with a real cache file.
    const result = checkForUpdate({ name: 'pr-dashboard-test-no-such-pkg-xyz', version: '0.0.1' })
    expect(result).toBeNull()
  })
})
