import React from 'react'
import { Box, Text } from 'ink'

import type { RateLimit } from '../github/client.ts'

interface Props {
  lastTickAt: number | null
  nextTickAt: number | null
  rateLimit: RateLimit | null
  now: number
  loading: boolean
  version: string
}

const fmtAgo = (ts: number | null, now: number): string => {
  if (ts === null) return '–'
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  return `${String(s)}s`
}

const fmtIn = (ts: number | null, now: number): string => {
  if (ts === null) return '–'
  const s = Math.max(0, Math.floor((ts - now) / 1000))
  return `${String(s)}s`
}

const KEYBINDS = '/filter · r refresh · enter open · x checks · s settings · q quit'

export const StatusFooter: React.FC<Props> = ({ lastTickAt, nextTickAt, rateLimit, now, loading, version }) => {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text dimColor>
          last poll {fmtAgo(lastTickAt, now)} ago · next in {fmtIn(nextTickAt, now)} · rate{' '}
          {rateLimit ? `${String(rateLimit.remaining)}/${String(rateLimit.limit)}` : '?'}
          {loading ? ' · polling…' : ''} · v{version}
        </Text>
      </Box>
      <Box>
        <Text dimColor>{KEYBINDS}</Text>
      </Box>
    </Box>
  )
}
