import { graphqlQuery } from '@/github/client.ts'
import type { GraphqlResult } from '@/github/client.ts'
import type {
  CIState,
  DetailedPR,
  FailedCheck,
  IndexedPR,
  MergeStateStatus,
  MergeableState,
  ReviewDecision,
} from '@/github/types.ts'

interface CheckContextNode {
  __typename?: string
  name?: string
  conclusion?: string | null
  status?: string | null
  detailsUrl?: string | null
  context?: string
  state?: string | null
  targetUrl?: string | null
}

interface DetailNode {
  id: string
  number: number
  url: string
  title: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  additions: number
  deletions: number
  changedFiles: number
  reviewDecision: ReviewDecision
  mergeable: MergeableState
  mergeStateStatus: MergeStateStatus
  headRefOid: string
  author: { login: string } | null
  repository: { nameWithOwner: string }
  reviewRequests: { totalCount: number }
  commits: {
    nodes: {
      commit: {
        statusCheckRollup: {
          state: CIState
          contexts: { nodes: CheckContextNode[] }
        } | null
      }
    }[]
  }
}

interface DetailResponse {
  nodes: (DetailNode | null)[]
  rateLimit: { remaining: number; limit: number; resetAt: string }
}

const DETAIL_QUERY = `
query PRDetails($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on PullRequest {
      id
      number
      url
      title
      isDraft
      createdAt
      updatedAt
      additions
      deletions
      changedFiles
      reviewDecision
      mergeable
      mergeStateStatus
      headRefOid
      author { login }
      repository { nameWithOwner }
      reviewRequests { totalCount }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              state
              contexts(first: 30) {
                nodes {
                  __typename
                  ... on CheckRun { name conclusion status detailsUrl }
                  ... on StatusContext { context state targetUrl }
                }
              }
            }
          }
        }
      }
    }
  }
  rateLimit { remaining limit resetAt }
}`

const extractFailedChecks = (contexts: CheckContextNode[]): FailedCheck[] => {
  const failed: FailedCheck[] = []
  for (const c of contexts) {
    const isFailingCheckRun =
      c.conclusion === 'FAILURE' || c.conclusion === 'CANCELLED' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'STARTUP_FAILURE'
    const isFailingStatus = c.state === 'FAILURE' || c.state === 'ERROR'
    if (isFailingCheckRun || isFailingStatus) {
      failed.push({
        name: c.name ?? c.context ?? 'unknown',
        detailsUrl: c.detailsUrl ?? c.targetUrl ?? null,
      })
    }
  }
  return failed
}

const countPending = (contexts: CheckContextNode[]): number => {
  let pending = 0
  for (const c of contexts) {
    if (c.status === 'IN_PROGRESS' || c.status === 'QUEUED' || c.status === 'PENDING') pending++
    else if (c.state === 'PENDING' || c.state === 'EXPECTED') pending++
  }
  return pending
}

const mapNode = (node: DetailNode): DetailedPR => {
  const rollup = node.commits.nodes[0]?.commit.statusCheckRollup
  const contexts = rollup?.contexts.nodes ?? []
  return {
    id: node.id,
    number: node.number,
    url: node.url,
    repoFullName: node.repository.nameWithOwner,
    updatedAt: node.updatedAt,
    headRefOid: node.headRefOid,
    title: node.title,
    author: node.author?.login ?? null,
    isDraft: node.isDraft,
    createdAt: node.createdAt,
    reviewDecision: node.reviewDecision,
    mergeable: node.mergeable,
    mergeStateStatus: node.mergeStateStatus,
    ciState: rollup?.state ?? null,
    failedChecks: extractFailedChecks(contexts),
    pendingChecks: countPending(contexts),
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    reviewRequestCount: node.reviewRequests.totalCount,
  }
}

export const fetchDetails = async (ids: string[]): Promise<GraphqlResult<DetailedPR[]>> => {
  if (ids.length === 0) return { data: [], rateLimit: null }
  const result = await graphqlQuery<DetailResponse>(DETAIL_QUERY, { ids })
  const prs = result.data.nodes.filter((n): n is DetailNode => n !== null).map(mapNode)
  return { data: prs, rateLimit: result.rateLimit }
}

export const detailQueryFor = (_indexed: IndexedPR[]): string => DETAIL_QUERY
