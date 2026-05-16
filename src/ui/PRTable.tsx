import React from 'react'
import { Box, Text } from 'ink'

import { daysSince, relativeTime } from '@/format/relativeTime.ts'
import { ciGlyph, cleanTitle, mergeGlyph, reviewGlyph } from '@/format/status.ts'
import { COLUMN_SPECS } from '@/ui/columns.ts'
import type { ColumnKey } from '@/config/schema.ts'
import type { DetailedPR } from '@/github/types.ts'

interface Props {
  prs: DetailedPR[]
  columns: ColumnKey[]
  cursor: number
  now: number
  flashUntil: Map<string, number>
  terminalWidth: number
}

const truncate = (s: string, w: number): string => (s.length <= w ? s.padEnd(w) : s.slice(0, w - 1) + '…')

const computeFlexWidth = (terminalWidth: number, columns: ColumnKey[]): number => {
  let fixed = 0
  let flexCount = 0
  for (const key of columns) {
    const spec = COLUMN_SPECS[key]
    if (spec.width === 'flex') flexCount++
    else fixed += spec.width
  }
  // gap of 1 char between cols + 2 col gutter for cursor marker
  const gutter = columns.length + 2
  const flex = Math.max(20, terminalWidth - fixed - gutter)
  return flexCount > 0 ? Math.floor(flex / flexCount) : flex
}

interface CellProps {
  width: number
  children: React.ReactNode
}

const Cell: React.FC<CellProps> = ({ width, children }) => (
  <Box width={width} flexShrink={0} marginRight={1}>
    {children}
  </Box>
)

interface RowProps {
  pr: DetailedPR
  columns: ColumnKey[]
  isCursor: boolean
  flashing: boolean
  flexWidth: number
  now: number
}

const PRRow: React.FC<RowProps> = ({ pr, columns, isCursor, flashing, flexWidth, now }) => {
  const ageDays = daysSince(pr.createdAt, now)
  const stale = ageDays > 7
  const bg = flashing ? 'magenta' : isCursor ? 'blue' : undefined
  const baseColor = bg ? 'white' : undefined
  return (
    <Box>
      <Box width={2} flexShrink={0}>
        <Text color={isCursor ? 'cyan' : undefined}>{isCursor ? '›' : ' '}</Text>
      </Box>
      {columns.map(col => {
        const spec = COLUMN_SPECS[col]
        const width = spec.width === 'flex' ? flexWidth : spec.width
        switch (col) {
          case 'repo':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={baseColor ?? 'gray'}>
                  {truncate(pr.repoFullName, width)}
                </Text>
              </Cell>
            )
          case 'number':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={baseColor ?? 'gray'}>
                  {truncate(`#${String(pr.number)}`, width)}
                </Text>
              </Cell>
            )
          case 'title':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={baseColor} bold={pr.isDraft ? false : undefined}>
                  {truncate(cleanTitle(pr.title), width)}
                </Text>
              </Cell>
            )
          case 'ci': {
            const g = ciGlyph(pr.ciState)
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={g.color}>
                  {truncate(g.char, width)}
                </Text>
              </Cell>
            )
          }
          case 'review': {
            const g = reviewGlyph(pr.reviewDecision, pr.reviewRequestCount)
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={g.color}>
                  {truncate(g.char, width)}
                </Text>
              </Cell>
            )
          }
          case 'merge': {
            const g = mergeGlyph(pr.mergeable, pr.mergeStateStatus, pr.isDraft)
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={g.color}>
                  {truncate(g.char, width)}
                </Text>
              </Cell>
            )
          }
          case 'age':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={stale ? 'red' : (baseColor ?? 'gray')} bold={stale}>
                  {truncate(`${String(ageDays)}d`, width)}
                </Text>
              </Cell>
            )
          case 'updated':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={bg} color={baseColor ?? 'gray'}>
                  {truncate(relativeTime(pr.updatedAt, now), width)}
                </Text>
              </Cell>
            )
        }
      })}
    </Box>
  )
}

export const PRTable: React.FC<Props> = ({ prs, columns, cursor, now, flashUntil, terminalWidth }) => {
  const flexWidth = computeFlexWidth(terminalWidth, columns)

  if (prs.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>No PRs in this preset.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={2} flexShrink={0} />
        {columns.map(col => {
          const spec = COLUMN_SPECS[col]
          const width = spec.width === 'flex' ? flexWidth : spec.width
          return (
            <Cell key={col} width={width}>
              <Text bold underline>
                {truncate(spec.label, width)}
              </Text>
            </Cell>
          )
        })}
      </Box>
      {prs.map((pr, i) => {
        const until = flashUntil.get(pr.id) ?? 0
        return (
          <PRRow
            key={pr.id}
            pr={pr}
            columns={columns}
            isCursor={i === cursor}
            flashing={until > now}
            flexWidth={flexWidth}
            now={now}
          />
        )
      })}
    </Box>
  )
}
