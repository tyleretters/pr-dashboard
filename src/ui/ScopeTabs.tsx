import React from 'react'
import { Box, Text } from 'ink'

interface Props {
  scopes: { key: string; label: string }[]
  active: string
}

export const ScopeTabs: React.FC<Props> = ({ scopes, active }) => {
  return (
    <Box paddingX={1}>
      {scopes.map((p, i) => (
        <Box key={p.key} marginRight={1}>
          <Text dimColor>[{String(i + 1)}]</Text>
          <Text color={p.key === active ? '#F51700' : undefined}>
            {' '}
            {p.label}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
