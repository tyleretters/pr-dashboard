import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runOneTick, startScheduler } from '../src/poll/scheduler.ts'
import type { PollTick } from '../src/poll/scheduler.ts'
import type { DetailedPR, IndexedPR } from '../src/github/types.ts'

const indexed = (id: string, updatedAt = '2026-05-16T12:00:00Z', headRefOid = 'abc'): IndexedPR => ({
  id,
  number: Number(id.replace(/\D/g, '')) || 1,
  url: `https://github.com/o/r/pull/${id}`,
  repoFullName: 'o/r',
  updatedAt,
  headRefOid,
})

const detail = (id: string, overrides: Partial<DetailedPR> = {}): DetailedPR => ({
  ...indexed(id),
  title: 't',
  author: 't',
  isDraft: false,
  createdAt: '2026-05-10T12:00:00Z',
  reviewDecision: null,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  ciState: 'SUCCESS',
  failedChecks: [],
  pendingChecks: 0,
  additions: 0,
  deletions: 0,
  changedFiles: 0,
  reviewRequestCount: 0,
  ...overrides,
})

describe('runOneTick', () => {
  it('fetches details for all PRs on first run, none on second run when nothing changed', async () => {
    const fetchIndex = vi.fn(() => Promise.resolve({ data: [indexed('a'), indexed('b')], rateLimit: null }))
    const fetchDetails = vi.fn((ids: string[]) => Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null }))
    const cache = new Map<string, DetailedPR>()
    const opts = { scope: { scopeKey: 'work', filters: ['q'] }, detailBatchSize: 25 }

    const first = await runOneTick(opts, cache, { fetchIndex, fetchDetails })
    expect(first.prs).toHaveLength(2)
    expect(fetchDetails).toHaveBeenCalledTimes(1)
    expect(fetchDetails.mock.calls[0]?.[0]).toEqual(['a', 'b'])

    fetchDetails.mockClear()
    const second = await runOneTick(opts, cache, { fetchIndex, fetchDetails })
    expect(second.prs).toHaveLength(2)
    expect(fetchDetails).not.toHaveBeenCalled()
  })

  it('fetches details only for changed PRs on subsequent ticks', async () => {
    const a1 = indexed('a', '2026-05-16T12:00:00Z')
    const b1 = indexed('b', '2026-05-16T12:00:00Z')
    const a2 = indexed('a', '2026-05-16T13:00:00Z') // updated
    const fetchIndex = vi
      .fn<(q: string) => Promise<{ data: IndexedPR[]; rateLimit: null }>>()
      .mockResolvedValueOnce({ data: [a1, b1], rateLimit: null })
      .mockResolvedValueOnce({ data: [a2, b1], rateLimit: null })
    const fetchDetails = vi.fn((ids: string[]) => Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null }))
    const cache = new Map<string, DetailedPR>()
    const opts = { scope: { scopeKey: 'work', filters: ['q'] }, detailBatchSize: 25 }

    await runOneTick(opts, cache, { fetchIndex, fetchDetails })
    fetchDetails.mockClear()

    const second = await runOneTick(opts, cache, { fetchIndex, fetchDetails })
    expect(fetchDetails).toHaveBeenCalledTimes(1)
    expect(fetchDetails.mock.calls[0]?.[0]).toEqual(['a'])
    expect(second.prs).toHaveLength(2)
  })

  it('batches detail fetches by detailBatchSize', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => indexed(`p${String(i)}`))
    const fetchIndex = vi.fn(() => Promise.resolve({ data: ids, rateLimit: null }))
    const fetchDetails = vi.fn((idsBatch: string[]) =>
      Promise.resolve({ data: idsBatch.map(id => detail(id)), rateLimit: null })
    )
    const cache = new Map<string, DetailedPR>()
    const opts = { scope: { scopeKey: 'work', filters: ['q'] }, detailBatchSize: 25 }

    await runOneTick(opts, cache, { fetchIndex, fetchDetails })
    expect(fetchDetails).toHaveBeenCalledTimes(3) // 25 + 25 + 10
    const totalIds = fetchDetails.mock.calls.flatMap(c => c[0])
    expect(totalIds).toHaveLength(60)
  })

  it('captures errors without throwing', async () => {
    const fetchIndex = vi.fn(() => Promise.reject(new Error('boom')))
    const fetchDetails = vi.fn(() => Promise.resolve({ data: [], rateLimit: null }))
    const cache = new Map<string, DetailedPR>()
    const opts = { scope: { scopeKey: 'work', filters: ['q'] }, detailBatchSize: 25 }
    const tick = await runOneTick(opts, cache, { fetchIndex, fetchDetails })
    expect(tick.error).not.toBeNull()
    expect(tick.error?.message).toBe('boom')
  })

  it('dedupes PRs that match multiple filters in one scope', async () => {
    const a = indexed('a')
    const fetchIndex = vi
      .fn<(q: string) => Promise<{ data: IndexedPR[]; rateLimit: null }>>()
      .mockResolvedValueOnce({ data: [a], rateLimit: null })
      .mockResolvedValueOnce({ data: [a], rateLimit: null })
    const fetchDetails = vi.fn((ids: string[]) => Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null }))
    const cache = new Map<string, DetailedPR>()
    const opts = { scope: { scopeKey: 'work', filters: ['q1', 'q2'] }, detailBatchSize: 25 }
    const tick = await runOneTick(opts, cache, { fetchIndex, fetchDetails })
    expect(tick.prs).toHaveLength(1)
    expect(fetchDetails.mock.calls[0]?.[0]).toEqual(['a'])
  })
})

describe('startScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits a tick immediately on start', async () => {
    const fetchIndex = vi.fn(() => Promise.resolve({ data: [indexed('a')], rateLimit: null }))
    const fetchDetails = vi.fn((ids: string[]) =>
      Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null })
    )
    const onTick = vi.fn<(t: PollTick) => void>()
    const handle = startScheduler(
      { scope: { scopeKey: 'work', filters: ['q'] }, indexIntervalMs: 1000, detailBatchSize: 25, onTick },
      { fetchIndex, fetchDetails }
    )
    await vi.waitFor(() => {
      expect(onTick).toHaveBeenCalledTimes(1)
    })
    handle.stop()
  })

  it('re-ticks after indexIntervalMs', async () => {
    const fetchIndex = vi.fn(() => Promise.resolve({ data: [indexed('a')], rateLimit: null }))
    const fetchDetails = vi.fn((ids: string[]) =>
      Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null })
    )
    const onTick = vi.fn<(t: PollTick) => void>()
    const handle = startScheduler(
      { scope: { scopeKey: 'work', filters: ['q'] }, indexIntervalMs: 1000, detailBatchSize: 25, onTick },
      { fetchIndex, fetchDetails }
    )
    await vi.waitFor(() => {
      expect(onTick).toHaveBeenCalledTimes(1)
    })
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() => {
      expect(onTick).toHaveBeenCalledTimes(2)
    })
    handle.stop()
  })

  it('stops emitting after stop() is called', async () => {
    const fetchIndex = vi.fn(() => Promise.resolve({ data: [indexed('a')], rateLimit: null }))
    const fetchDetails = vi.fn((ids: string[]) =>
      Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null })
    )
    const onTick = vi.fn<(t: PollTick) => void>()
    const handle = startScheduler(
      { scope: { scopeKey: 'work', filters: ['q'] }, indexIntervalMs: 1000, detailBatchSize: 25, onTick },
      { fetchIndex, fetchDetails }
    )
    await vi.waitFor(() => {
      expect(onTick).toHaveBeenCalledTimes(1)
    })
    handle.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('forceRefresh triggers an extra tick before the scheduled one', async () => {
    const fetchIndex = vi.fn(() => Promise.resolve({ data: [indexed('a')], rateLimit: null }))
    const fetchDetails = vi.fn((ids: string[]) =>
      Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null })
    )
    const onTick = vi.fn<(t: PollTick) => void>()
    const handle = startScheduler(
      { scope: { scopeKey: 'work', filters: ['q'] }, indexIntervalMs: 10_000, detailBatchSize: 25, onTick },
      { fetchIndex, fetchDetails }
    )
    await vi.waitFor(() => {
      expect(onTick).toHaveBeenCalledTimes(1)
    })
    handle.forceRefresh()
    await vi.waitFor(() => {
      expect(onTick).toHaveBeenCalledTimes(2)
    })
    handle.stop()
  })

  it('setScope clears cache and re-ticks with the new scope', async () => {
    const fetchIndex = vi.fn(() => Promise.resolve({ data: [indexed('a')], rateLimit: null }))
    const fetchDetails = vi.fn((ids: string[]) =>
      Promise.resolve({ data: ids.map(id => detail(id)), rateLimit: null })
    )
    const onTick = vi.fn<(t: PollTick) => void>()
    const handle = startScheduler(
      { scope: { scopeKey: 'work', filters: ['q'] }, indexIntervalMs: 10_000, detailBatchSize: 25, onTick },
      { fetchIndex, fetchDetails }
    )
    await vi.waitFor(() => {
      expect(onTick).toHaveBeenCalledTimes(1)
    })
    handle.setScope({ scopeKey: 'personal', filters: ['q2'] })
    await vi.waitFor(() => {
      const calls = onTick.mock.calls
      expect(calls[calls.length - 1]?.[0].scopeKey).toBe('personal')
    })
    handle.stop()
  })
})
