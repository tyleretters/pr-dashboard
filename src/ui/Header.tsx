import React from 'react'
import { Box, Text } from 'ink'

interface Props {
  presetLabel: string
  presetKey: string
  totalCount: number
  visibleCount: number
  error: string | null
  filterText: string
}

export const Header: React.FC<Props> = ({
  presetLabel,
  presetKey,
  totalCount,
  visibleCount,
  error,
  filterText,
}) => {
  const count = filterText ? `${String(visibleCount)}/${String(totalCount)}` : String(totalCount)
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#F51700" paddingX={1}>
      <Box>
        <Text bold color="#F51700">
          prd
        </Text>
        <Text> · </Text>
        <Text bold>{presetLabel}</Text>
        <Text dimColor> ({presetKey})</Text>
        <Text> · </Text>
        <Text>{count} PRs</Text>
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
