import React from 'react'
import { Box, Text } from 'ink'

import type { DetailedPR } from '@/github/types.ts'

interface Props {
  pr: DetailedPR | null
}

export const FailedChecks: React.FC<Props> = ({ pr }) => {
  if (!pr) return null
  if (pr.failedChecks.length === 0 && pr.pendingChecks === 0 && pr.ciState !== 'FAILURE') return null
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box>
        <Text bold>{pr.repoFullName}#{String(pr.number)}</Text>
        <Text dimColor> · {pr.url}</Text>
      </Box>
      {pr.failedChecks.length > 0 ? (
        <Box flexDirection="column">
          <Text color="red">Failed checks:</Text>
          {pr.failedChecks.map(c => (
            <Box key={c.name}>
              <Text>  </Text>
              <Text color="red">✗</Text>
              <Text> {c.name}</Text>
              {c.detailsUrl ? <Text dimColor> {c.detailsUrl}</Text> : null}
            </Box>
          ))}
        </Box>
      ) : null}
      {pr.pendingChecks > 0 ? (
        <Text color="yellow">{String(pr.pendingChecks)} checks pending</Text>
      ) : null}
    </Box>
  )
}
