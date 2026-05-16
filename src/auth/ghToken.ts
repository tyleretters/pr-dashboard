import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class GhMissingError extends Error {
  constructor() {
    super('gh CLI not found on PATH. Install: brew install gh && gh auth login')
    this.name = 'GhMissingError'
  }
}

export class GhAuthError extends Error {
  constructor(detail: string) {
    super(`gh CLI is not authenticated. Run: gh auth login\n${detail}`)
    this.name = 'GhAuthError'
  }
}

export const verifyGhAvailable = async (): Promise<void> => {
  try {
    await execFileAsync('gh', ['--version'])
  } catch {
    throw new GhMissingError()
  }
  try {
    await execFileAsync('gh', ['auth', 'status'])
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new GhAuthError(detail)
  }
}

export const getAuthenticatedUser = async (): Promise<string> => {
  const { stdout } = await execFileAsync('gh', ['api', 'user', '--jq', '.login'])
  return stdout.trim()
}
