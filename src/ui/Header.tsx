import React from 'react'
import { Box, Text } from 'ink'

import type { RateLimit } from '@/github/client.ts'

interface Props {
  presetLabel: string
  presetKey: string
  totalCount: number
  visibleCount: number
  lastTickAt: number | null
  nextTickAt: number | null
  rateLimit: RateLimit | null
  now: number
  loading: boolean
  error: string | null
  filterText: string
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

export const Header: React.FC<Props> = ({
  presetLabel,
  presetKey,
  totalCount,
  visibleCount,
  lastTickAt,
  nextTickAt,
  rateLimit,
  now,
  loading,
  error,
  filterText,
}) => {
  const count = filterText ? `${String(visibleCount)}/${String(totalCount)}` : String(totalCount)
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box>
        <Text bold color="cyan">
          prd
        </Text>
        <Text> · preset </Text>
        <Text bold>{presetLabel}</Text>
        <Text dimColor> ({presetKey})</Text>
        <Text> · </Text>
        <Text>{count} PRs</Text>
        <Text> · last poll </Text>
        <Text bold>{fmtAgo(lastTickAt, now)}</Text>
        <Text> ago · next in </Text>
        <Text bold>{fmtIn(nextTickAt, now)}</Text>
        <Text> · rate </Text>
        <Text color={rateLimit && rateLimit.remaining < 500 ? 'red' : 'gray'}>
          {rateLimit ? `${String(rateLimit.remaining)}/${String(rateLimit.limit)}` : '?'}
        </Text>
        {loading ? <Text color="yellow"> · polling…</Text> : null}
      </Box>
      {error ? (
        <Box>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}
      {filterText ? (
        <Box>
          <Text dimColor>filter: </Text>
          <Text>{filterText}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
