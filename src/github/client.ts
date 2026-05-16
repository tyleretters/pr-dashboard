import { execFile } from 'node:child_process'

export interface RateLimit {
  remaining: number
  limit: number
  resetAt: string | null
}

export interface GraphqlResult<T> {
  data: T
  rateLimit: RateLimit | null
}

interface RawResponse {
  data?: unknown
  errors?: { message: string }[]
}

interface RateLimitNode {
  remaining?: number
  limit?: number
  resetAt?: string
}

const hasRateLimitField = (data: unknown): data is { rateLimit: RateLimitNode } => {
  return typeof data === 'object' && data !== null && 'rateLimit' in data
}

export const graphqlQuery = async <T>(query: string, variables: Record<string, unknown> = {}): Promise<GraphqlResult<T>> => {
  const args = ['api', 'graphql', '-f', `query=${query}`]
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'number') {
      args.push('-F', `${key}=${String(value)}`)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        args.push('-f', `${key}[]=${String(item)}`)
      }
    } else {
      args.push('-f', `${key}=${String(value)}`)
    }
  }

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = execFile('gh', args, { maxBuffer: 16 * 1024 * 1024 }, (err, out, errOut) => {
      if (err) {
        reject(new Error(`gh api graphql failed: ${err.message}\n${errOut}`))
        return
      }
      resolve(out)
    })
    child.on('error', reject)
  })

  const parsed = JSON.parse(stdout) as RawResponse
  if (parsed.errors && parsed.errors.length > 0) {
    throw new Error(`GraphQL errors: ${parsed.errors.map(e => e.message).join('; ')}`)
  }
  if (parsed.data === undefined) {
    throw new Error('GraphQL response missing data field')
  }

  let rateLimit: RateLimit | null = null
  if (hasRateLimitField(parsed.data)) {
    const rl = parsed.data.rateLimit
    if (typeof rl.remaining === 'number' && typeof rl.limit === 'number') {
      rateLimit = {
        remaining: rl.remaining,
        limit: rl.limit,
        resetAt: rl.resetAt ?? null,
      }
    }
  }

  return { data: parsed.data as T, rateLimit }
}
