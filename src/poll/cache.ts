import type { DetailedPR, IndexedPR, MergeStateStatus } from '../github/types.ts'

const TRANSIENT_MERGE_STATES: ReadonlySet<MergeStateStatus> = new Set<MergeStateStatus>([
  'BLOCKED',
  'BEHIND',
  'UNSTABLE',
  'HAS_HOOKS',
  'UNKNOWN',
])

const isTransient = (prev: DetailedPR): boolean =>
  prev.ciState === 'PENDING' ||
  prev.ciState === 'EXPECTED' ||
  prev.mergeable === 'UNKNOWN' ||
  TRANSIENT_MERGE_STATES.has(prev.mergeStateStatus)

/**
 * Decide which indexed PRs need a detail fetch.
 * Reasons:
 *  - new id (not in cache)
 *  - updatedAt or headRefOid changed since last detail snapshot
 *  - cached detail is in a transient state (CI pending, async mergeability still
 *    resolving, BLOCKED/BEHIND/UNSTABLE/HAS_HOOKS) — these flips do not bump
 *    PullRequest.updatedAt, so we have to poll them explicitly
 */
export const diffForDetailFetch = (indexed: IndexedPR[], previous: Map<string, DetailedPR>): string[] => {
  const changed: string[] = []
  for (const pr of indexed) {
    const prev = previous.get(pr.id)
    if (prev?.updatedAt !== pr.updatedAt || prev.headRefOid !== pr.headRefOid || isTransient(prev)) {
      changed.push(pr.id)
    }
  }
  return changed
}

export interface MergeResult {
  next: Map<string, DetailedPR>
  changedIds: Set<string>
  removedIds: Set<string>
}

/**
 * Merge the latest indexed view with whatever detail rows we just fetched.
 * - Drops rows that fell out of the index (PR closed, merged, or out of scope).
 * - Keeps cached detail for rows that didn't change.
 * - Replaces detail for rows that did.
 * - Stamps lastDetailChangedAt on rows whose detail changed (used for row-flash).
 */
export const mergeSnapshot = (
  previous: Map<string, DetailedPR>,
  indexed: IndexedPR[],
  freshDetails: DetailedPR[],
  now: number = Date.now()
): MergeResult => {
  const indexedIds = new Set(indexed.map(p => p.id))
  const freshById = new Map(freshDetails.map(d => [d.id, d]))
  const next = new Map<string, DetailedPR>()
  const changedIds = new Set<string>()
  const removedIds = new Set<string>()

  for (const idx of indexed) {
    const fresh = freshById.get(idx.id)
    const prev = previous.get(idx.id)
    if (fresh) {
      const unchanged = prev?.headRefOid === fresh.headRefOid && prev.updatedAt === fresh.updatedAt && !detailChanged(prev, fresh)
      const merged: DetailedPR = { ...fresh, lastDetailChangedAt: unchanged ? prev.lastDetailChangedAt : now }
      if (!prev || detailChanged(prev, fresh)) changedIds.add(idx.id)
      next.set(idx.id, merged)
    } else if (prev) {
      next.set(idx.id, { ...prev, updatedAt: idx.updatedAt, headRefOid: idx.headRefOid })
    }
  }

  for (const id of previous.keys()) {
    if (!indexedIds.has(id)) removedIds.add(id)
  }

  return { next, changedIds, removedIds }
}

const detailChanged = (a: DetailedPR, b: DetailedPR): boolean => {
  return (
    a.ciState !== b.ciState ||
    a.reviewDecision !== b.reviewDecision ||
    a.mergeable !== b.mergeable ||
    a.mergeStateStatus !== b.mergeStateStatus ||
    a.isDraft !== b.isDraft ||
    a.title !== b.title ||
    a.failedChecks.length !== b.failedChecks.length ||
    a.pendingChecks !== b.pendingChecks ||
    a.additions !== b.additions ||
    a.deletions !== b.deletions
  )
}
