import React from 'react'
import { Box, Text } from 'ink'

interface Props {
  presets: { key: string; label: string }[]
  active: string
}

export const PresetTabs: React.FC<Props> = ({ presets, active }) => {
  return (
    <Box paddingX={1}>
      {presets.map((p, i) => (
        <Box key={p.key} marginRight={1}>
          <Text dimColor>[{String(i + 1)}]</Text>
          <Text color={p.key === active ? 'cyan' : undefined} bold={p.key === active}>
            {' '}
            {p.label}
          </Text>
        </Box>
      ))}
      <Text dimColor> · /filter · r refresh · enter checks · o open · c copy · q quit</Text>
    </Box>
  )
}
