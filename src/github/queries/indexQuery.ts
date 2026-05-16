import { graphqlQuery } from '@/github/client.ts'
import type { GraphqlResult } from '@/github/client.ts'
import type { IndexedPR } from '@/github/types.ts'

interface IndexResponseNode {
  id: string
  number: number
  url: string
  updatedAt: string
  repository: { nameWithOwner: string }
  headRefOid: string
}

interface IndexResponse {
  search: {
    issueCount: number
    nodes: IndexResponseNode[]
  }
  rateLimit: { remaining: number; limit: number; resetAt: string }
}

const INDEX_QUERY = `
query IndexPRs($q: String!) {
  search(query: $q, type: ISSUE, first: 100) {
    issueCount
    nodes {
      ... on PullRequest {
        id
        number
        url
        updatedAt
        repository { nameWithOwner }
        headRefOid
      }
    }
  }
  rateLimit { remaining limit resetAt }
}`

export const fetchIndex = async (searchQuery: string): Promise<GraphqlResult<IndexedPR[]>> => {
  const result = await graphqlQuery<IndexResponse>(INDEX_QUERY, { q: searchQuery })
  const prs: IndexedPR[] = result.data.search.nodes
    .filter((n): n is IndexResponseNode => Boolean(n.id))
    .map(n => ({
      id: n.id,
      number: n.number,
      url: n.url,
      repoFullName: n.repository.nameWithOwner,
      updatedAt: n.updatedAt,
      headRefOid: n.headRefOid,
    }))
  return { data: prs, rateLimit: result.rateLimit }
}
