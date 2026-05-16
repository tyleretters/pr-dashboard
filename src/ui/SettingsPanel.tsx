import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'

import type { Scope } from '@/config/schema.ts'

interface Props {
  scopes: Scope[]
  onSave: (next: Scope[]) => void
  onCancel: () => void
}

export const SettingsPanel: React.FC<Props> = ({ scopes, onSave, onCancel }) => {
  const [draft, setDraft] = useState(scopes)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    setDraft(scopes)
    setCursor(0)
  }, [scopes])

  useInput((input, key) => {
    if (key.escape) {
      onCancel()
      return
    }
    if (key.return) {
      onSave(draft)
      return
    }
    if (input === 'j' || key.downArrow) {
      setCursor(c => Math.min(c + 1, draft.length - 1))
      return
    }
    if (input === 'k' || key.upArrow) {
      setCursor(c => Math.max(0, c - 1))
      return
    }
    if (input === ' ' || input === 'x') {
      setDraft(prev => prev.map((s, i) => (i === cursor ? { ...s, enabled: !s.enabled } : s)))
      return
    }
    if (input === 'a') {
      setDraft(prev => prev.map(s => ({ ...s, enabled: true })))
      return
    }
    if (input === 'n') {
      setDraft(prev => prev.map(s => ({ ...s, enabled: false })))
      return
    }
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#F51700" paddingX={1}>
      <Box>
        <Text bold color="#F51700">
          Settings
        </Text>
        <Text dimColor> · toggle which orgs and users appear as tabs</Text>
      </Box>
      <Box marginY={1} flexDirection="column">
        {draft.length === 0 ? (
          <Text dimColor>No scopes discovered.</Text>
        ) : (
          draft.map((s, i) => (
            <Box key={s.key}>
              <Box width={2}>
                <Text color={i === cursor ? '#F51700' : undefined}>{i === cursor ? '›' : ' '}</Text>
              </Box>
              <Box width={4}>
                <Text color={s.enabled ? 'green' : 'gray'}>{s.enabled ? '[x]' : '[ ]'}</Text>
              </Box>
              <Text color={i === cursor ? '#F51700' : undefined} bold={i === cursor}>
                {s.label}
              </Text>
              {s.isUser ? <Text dimColor> (you)</Text> : null}
            </Box>
          ))
        )}
      </Box>
      <Box>
        <Text dimColor>j/k move · space toggle · a all · n none · enter save · esc cancel</Text>
      </Box>
    </Box>
  )
}
