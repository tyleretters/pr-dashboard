export type CIState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null

export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null

export type MergeableState = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'

export type MergeStateStatus =
  | 'BEHIND'
  | 'BLOCKED'
  | 'CLEAN'
  | 'DIRTY'
  | 'DRAFT'
  | 'HAS_HOOKS'
  | 'UNKNOWN'
  | 'UNSTABLE'

export interface IndexedPR {
  id: string
  number: number
  url: string
  repoFullName: string
  updatedAt: string
  headRefOid: string
}

export interface FailedCheck {
  name: string
  detailsUrl: string | null
}

export interface DetailedPR extends IndexedPR {
  title: string
  author: string | null
  isDraft: boolean
  createdAt: string
  reviewDecision: ReviewDecision
  mergeable: MergeableState
  mergeStateStatus: MergeStateStatus
  ciState: CIState
  failedChecks: FailedCheck[]
  pendingChecks: number
  additions: number
  deletions: number
  changedFiles: number
  reviewRequestCount: number
  /** Internal: timestamp when this row last had a detail field change, used for the UI row-flash. */
  lastDetailChangedAt?: number
}
