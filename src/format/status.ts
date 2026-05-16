import type { CIState, MergeStateStatus, MergeableState, ReviewDecision } from '../github/types.ts'

export interface Glyph {
  char: string
  color: 'green' | 'red' | 'yellow' | 'cyan' | 'magenta' | 'gray' | 'white'
}

export const ciGlyph = (state: CIState): Glyph => {
  switch (state) {
    case 'SUCCESS':
      return { char: '✓', color: 'green' }
    case 'FAILURE':
    case 'ERROR':
      return { char: '✗', color: 'red' }
    case 'PENDING':
    case 'EXPECTED':
      return { char: '●', color: 'yellow' }
    default:
      return { char: '–', color: 'gray' }
  }
}

export const reviewGlyph = (decision: ReviewDecision, reviewRequestCount: number): Glyph => {
  switch (decision) {
    case 'APPROVED':
      return { char: '✓', color: 'green' }
    case 'CHANGES_REQUESTED':
      return { char: '✗', color: 'red' }
    case 'REVIEW_REQUIRED':
      return { char: '?', color: 'yellow' }
    default:
      return reviewRequestCount > 0 ? { char: '?', color: 'yellow' } : { char: '·', color: 'gray' }
  }
}

export const mergeGlyph = (mergeable: MergeableState, state: MergeStateStatus, isDraft: boolean): Glyph => {
  if (isDraft) return { char: 'D', color: 'gray' }
  if (mergeable === 'CONFLICTING' || state === 'DIRTY') return { char: '✗', color: 'red' }
  switch (state) {
    case 'CLEAN':
      return { char: '✓', color: 'green' }
    case 'BLOCKED':
    case 'BEHIND':
    case 'UNSTABLE':
    case 'HAS_HOOKS':
      return { char: '⚠', color: 'yellow' }
    default:
      return { char: '·', color: 'gray' }
  }
}

const CONVENTIONAL_PREFIX = /^(feat|fix|chore|docs|refactor|test|perf|build|ci|revert|style)(\([^)]+\))?!?:\s*/i

export const cleanTitle = (title: string): string => title.replace(CONVENTIONAL_PREFIX, '')
