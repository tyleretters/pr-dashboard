import { z } from 'zod'

export const ColumnKey = z.enum(['repo', 'number', 'title', 'ci', 'review', 'merge', 'age', 'updated'])
export type ColumnKey = z.infer<typeof ColumnKey>

export const ConfigSchema = z.object({
  indexIntervalMs: z.number().int().min(5000).max(600000).default(20000),
  detailMaxBatchSize: z.number().int().min(1).max(100).default(25),
  /** Scopes (org slugs or the user's login) the dashboard shows as tabs. */
  enabledScopes: z.array(z.string().min(1)).default([]),
  /** Scopes the user explicitly disabled — kept so newly-discovered orgs default to on without re-enabling these. */
  disabledScopes: z.array(z.string().min(1)).default([]),
  columns: z.array(ColumnKey).min(1).default(['repo', 'number', 'title', 'ci', 'review', 'merge', 'age', 'updated']),
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = {
  indexIntervalMs: 20000,
  detailMaxBatchSize: 25,
  enabledScopes: [],
  disabledScopes: [],
  columns: ['repo', 'number', 'title', 'ci', 'review', 'merge', 'age', 'updated'],
}

/**
 * A scope (org or user). Built fresh on every boot from the viewer query
 * merged with the persisted enabled/disabled lists.
 */
export interface Scope {
  /** GitHub login (org slug or user login). */
  key: string
  /** Display label — same as key. */
  label: string
  /** Whether this is the authenticated user (rendered slightly differently if we ever want to). */
  isUser: boolean
  /** Whether this tab is currently visible in the dashboard. */
  enabled: boolean
}

/**
 * Merge discovered orgs/user with persisted config.
 *
 * Default rule: a newly-discovered scope is enabled unless it appears in disabledScopes.
 * A scope in enabledScopes that we no longer discover (e.g. left an org) is dropped silently.
 */
export const buildScopes = (
  login: string,
  orgs: string[],
  enabled: string[],
  disabled: string[]
): Scope[] => {
  const enabledSet = new Set(enabled)
  const disabledSet = new Set(disabled)
  const all = [login, ...orgs]
  const seen = new Set<string>()
  const scopes: Scope[] = []
  for (const key of all) {
    if (seen.has(key)) continue
    seen.add(key)
    const known = enabledSet.has(key) || disabledSet.has(key)
    const on = known ? enabledSet.has(key) : true
    scopes.push({ key, label: key, isUser: key === login, enabled: on })
  }
  scopes.sort((a, b) => a.key.localeCompare(b.key))
  return scopes
}

/**
 * Generate the search filter for a scope. Single query, "involves:@me" semantics.
 */
export const scopeToFilter = (scope: Scope): string => {
  const qualifier = scope.isUser ? `user:${scope.key}` : `org:${scope.key}`
  return `is:open is:pr involves:@me ${qualifier} archived:false`
}
