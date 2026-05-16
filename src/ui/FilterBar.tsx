import React from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}

export const FilterBar: React.FC<Props> = ({ value, onChange, onSubmit }) => {
  return (
    <Box paddingX={1}>
      <Text>/ </Text>
      <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
    </Box>
  )
}
