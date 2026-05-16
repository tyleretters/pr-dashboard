import { graphqlQuery } from '../client.ts'
import type { GraphqlResult } from '../client.ts'

export interface ViewerScopes {
  login: string
  orgs: string[]
}

interface ViewerResponse {
  viewer: {
    login: string
    organizations: {
      nodes: { login: string }[]
    }
  }
}

const VIEWER_QUERY = `
query Viewer {
  viewer {
    login
    organizations(first: 100) {
      nodes { login }
    }
  }
}`

export const fetchViewerScopes = async (): Promise<GraphqlResult<ViewerScopes>> => {
  const result = await graphqlQuery<ViewerResponse>(VIEWER_QUERY)
  const login = result.data.viewer.login
  const orgs = result.data.viewer.organizations.nodes.map(n => n.login).sort((a, b) => a.localeCompare(b))
  return { data: { login, orgs }, rateLimit: result.rateLimit }
}
