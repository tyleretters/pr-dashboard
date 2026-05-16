import React from 'react'
import { Box, Text } from 'ink'

import type { UpdateInfo } from '../update/checker.ts'

interface Props {
  update: UpdateInfo | null
}

export const UpdateBanner: React.FC<Props> = ({ update }) => {
  if (!update) return null
  return (
    <Box>
      <Text color="#F51700">
        update available: {update.current} → {update.latest} — run npm i -g {update.name}
      </Text>
    </Box>
  )
}
