import { fetchDetails } from '../github/queries/detailQuery.ts'
import { fetchIndex } from '../github/queries/indexQuery.ts'
import { diffForDetailFetch, mergeSnapshot } from './cache.ts'
import type { RateLimit } from '../github/client.ts'
import type { DetailedPR, IndexedPR } from '../github/types.ts'

export interface ScopeQuery {
  scopeKey: string
  filters: string[]
}

export interface PollTick {
  scopeKey: string
  prs: DetailedPR[]
  indexedCount: number
  changedIds: Set<string>
  removedIds: Set<string>
  rateLimit: RateLimit | null
  startedAt: number
  finishedAt: number
  error: Error | null
}

export interface SchedulerOptions {
  scope: ScopeQuery
  indexIntervalMs: number
  detailBatchSize: number
  onTick: (tick: PollTick) => void
}

interface Fetchers {
  fetchIndex: (q: string) => Promise<{ data: IndexedPR[]; rateLimit: RateLimit | null }>
  fetchDetails: (ids: string[]) => Promise<{ data: DetailedPR[]; rateLimit: RateLimit | null }>
}

export const defaultFetchers: Fetchers = { fetchIndex, fetchDetails }

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export interface RunOneTickOptions extends Pick<SchedulerOptions, 'scope' | 'detailBatchSize'> {
  /** When true, refetch details for every indexed PR regardless of cache state. */
  force?: boolean
}

export const runOneTick = async (
  opts: RunOneTickOptions,
  cache: Map<string, DetailedPR>,
  fetchers: Fetchers = defaultFetchers
): Promise<PollTick> => {
  const startedAt = Date.now()
  let lastRateLimit: RateLimit | null = null
  let allIndexed: IndexedPR[] = []
  try {
    for (const filter of opts.scope.filters) {
      const { data, rateLimit } = await fetchers.fetchIndex(filter)
      allIndexed = allIndexed.concat(data)
      if (rateLimit) lastRateLimit = rateLimit
    }

    // dedupe by id (a PR can match multiple filters in one scope)
    const seen = new Set<string>()
    allIndexed = allIndexed.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    const idsNeedingDetail = opts.force ? allIndexed.map(p => p.id) : diffForDetailFetch(allIndexed, cache)
    const detailBatches = chunk(idsNeedingDetail, opts.detailBatchSize)
    const freshDetails: DetailedPR[] = []
    for (const batch of detailBatches) {
      const { data, rateLimit } = await fetchers.fetchDetails(batch)
      freshDetails.push(...data)
      if (rateLimit) lastRateLimit = rateLimit
    }

    const { next, changedIds, removedIds } = mergeSnapshot(cache, allIndexed, freshDetails)
    cache.clear()
    for (const [k, v] of next) cache.set(k, v)

    return {
      scopeKey: opts.scope.scopeKey,
      prs: Array.from(cache.values()),
      indexedCount: allIndexed.length,
      changedIds,
      removedIds,
      rateLimit: lastRateLimit,
      startedAt,
      finishedAt: Date.now(),
      error: null,
    }
  } catch (err) {
    return {
      scopeKey: opts.scope.scopeKey,
      prs: Array.from(cache.values()),
      indexedCount: allIndexed.length,
      changedIds: new Set(),
      removedIds: new Set(),
      rateLimit: lastRateLimit,
      startedAt,
      finishedAt: Date.now(),
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

export interface SchedulerHandle {
  stop: () => void
  forceRefresh: () => void
  setScope: (scope: ScopeQuery) => void
}

export const startScheduler = (opts: SchedulerOptions, fetchers: Fetchers = defaultFetchers): SchedulerHandle => {
  let stopped = false
  let scope = opts.scope
  let cache = new Map<string, DetailedPR>()
  let timer: NodeJS.Timeout | null = null
  let inFlight: Promise<void> | null = null

  const tick = async (force = false): Promise<void> => {
    if (stopped) return
    const result = await runOneTick({ scope, detailBatchSize: opts.detailBatchSize, force }, cache, fetchers)
    if (!stopped) opts.onTick(result)
  }

  const schedule = (): void => {
    if (stopped) return
    timer = setTimeout(() => {
      inFlight = tick().finally(() => {
        inFlight = null
        schedule()
      })
    }, opts.indexIntervalMs)
  }

  // kick off immediately
  inFlight = tick().finally(() => {
    inFlight = null
    schedule()
  })

  return {
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    },
    forceRefresh: () => {
      if (timer) clearTimeout(timer)
      if (inFlight) {
        void inFlight.then(() => {
          if (!stopped) {
            inFlight = tick(true).finally(() => {
              inFlight = null
              schedule()
            })
          }
        })
      } else {
        inFlight = tick(true).finally(() => {
          inFlight = null
          schedule()
        })
      }
    },
    setScope: (next: ScopeQuery) => {
      scope = next
      cache = new Map()
      if (timer) clearTimeout(timer)
      inFlight ??= tick().finally(() => {
        inFlight = null
        schedule()
      })
    },
  }
}
