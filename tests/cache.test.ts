import { describe, expect, it } from 'vitest'

import { diffForDetailFetch, mergeSnapshot } from '../src/poll/cache.ts'
import type { DetailedPR, IndexedPR } from '../src/github/types.ts'

const makeIndexed = (overrides: Partial<IndexedPR> = {}): IndexedPR => ({
  id: 'PR_1',
  number: 1,
  url: 'https://github.com/o/r/pull/1',
  repoFullName: 'o/r',
  updatedAt: '2026-05-16T12:00:00Z',
  headRefOid: 'abc',
  ...overrides,
})

const makeDetail = (overrides: Partial<DetailedPR> = {}): DetailedPR => ({
  ...makeIndexed(overrides),
  title: 'title',
  author: 'tyler',
  isDraft: false,
  createdAt: '2026-05-10T12:00:00Z',
  reviewDecision: null,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  ciState: 'SUCCESS',
  failedChecks: [],
  pendingChecks: 0,
  additions: 1,
  deletions: 1,
  changedFiles: 1,
  reviewRequestCount: 0,
  ...overrides,
})

describe('diffForDetailFetch', () => {
  it('returns all new PR ids when cache is empty', () => {
    const indexed = [makeIndexed({ id: 'a' }), makeIndexed({ id: 'b' })]
    expect(diffForDetailFetch(indexed, new Map())).toEqual(['a', 'b'])
  })

  it('skips PRs whose updatedAt and headRefOid match the cache', () => {
    const cached = new Map([['a', makeDetail({ id: 'a' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual([])
  })

  it('refetches when updatedAt changes', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', updatedAt: '2026-05-15T00:00:00Z' })]])
    const indexed = [makeIndexed({ id: 'a', updatedAt: '2026-05-16T12:00:00Z' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('refetches when headRefOid changes (force-push)', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', headRefOid: 'old' })]])
    const indexed = [makeIndexed({ id: 'a', headRefOid: 'new' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('refetches when cached CI is PENDING even if updatedAt matches', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', ciState: 'PENDING' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('refetches when cached CI is EXPECTED even if updatedAt matches', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', ciState: 'EXPECTED' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('refetches when cached mergeStateStatus is BLOCKED even if updatedAt matches', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', mergeStateStatus: 'BLOCKED' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('refetches when cached mergeStateStatus is UNSTABLE even if updatedAt matches', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', mergeStateStatus: 'UNSTABLE' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('refetches when cached mergeStateStatus is UNKNOWN even if updatedAt matches', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', mergeStateStatus: 'UNKNOWN' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('refetches when cached mergeable is UNKNOWN even if updatedAt matches', () => {
    const cached = new Map([['a', makeDetail({ id: 'a', mergeable: 'UNKNOWN' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual(['a'])
  })

  it('does not refetch when cached state is terminal (SUCCESS + CLEAN)', () => {
    const cached = new Map([
      ['a', makeDetail({ id: 'a', ciState: 'SUCCESS', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE' })],
    ])
    const indexed = [makeIndexed({ id: 'a' })]
    expect(diffForDetailFetch(indexed, cached)).toEqual([])
  })
})

describe('mergeSnapshot', () => {
  it('drops PRs that fell out of the index', () => {
    const prev = new Map([
      ['a', makeDetail({ id: 'a' })],
      ['b', makeDetail({ id: 'b' })],
    ])
    const indexed = [makeIndexed({ id: 'a' })]
    const result = mergeSnapshot(prev, indexed, [], 1000)
    expect(result.next.has('a')).toBe(true)
    expect(result.next.has('b')).toBe(false)
    expect(result.removedIds.has('b')).toBe(true)
  })

  it('preserves cached detail when nothing fresh arrived', () => {
    const prev = new Map([['a', makeDetail({ id: 'a', title: 'cached' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    const result = mergeSnapshot(prev, indexed, [], 1000)
    expect(result.next.get('a')?.title).toBe('cached')
    expect(result.changedIds.size).toBe(0)
  })

  it('replaces detail and flags changed when CI flipped', () => {
    const prev = new Map([['a', makeDetail({ id: 'a', ciState: 'PENDING' })]])
    const indexed = [makeIndexed({ id: 'a' })]
    const fresh = [makeDetail({ id: 'a', ciState: 'SUCCESS' })]
    const result = mergeSnapshot(prev, indexed, fresh, 9999)
    expect(result.next.get('a')?.ciState).toBe('SUCCESS')
    expect(result.changedIds.has('a')).toBe(true)
    expect(result.next.get('a')?.lastDetailChangedAt).toBe(9999)
  })

  it('does not flag changed when detail is identical', () => {
    const fresh = makeDetail({ id: 'a' })
    const prev = new Map([['a', { ...fresh, lastDetailChangedAt: 1 }]])
    const indexed = [makeIndexed({ id: 'a' })]
    const result = mergeSnapshot(prev, indexed, [fresh], 9999)
    expect(result.changedIds.has('a')).toBe(false)
  })
})
