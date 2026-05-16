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

const PRRowImpl: React.FC<RowProps> = ({ pr, columns, isCursor, flashing, flexWidth, now }) => {
  const ageDays = daysSince(pr.createdAt, now)
  const stale = ageDays > 7
  // Flash on detail change keeps the magenta background so the change is
  // visually distinct from the normal cursor highlight.
  const flashBg = flashing ? 'magenta' : undefined
  // When cursor and not flashing: tint text red. When flashing: white on magenta.
  const cursorTint = isCursor && !flashing ? '#F51700' : undefined
  const flashFg = flashing ? 'white' : undefined
  const baseTextColor = flashFg ?? cursorTint ?? 'gray'
  const titleColor = flashFg ?? cursorTint
  return (
    <Box>
      <Box width={2} flexShrink={0}>
        <Text color={isCursor ? '#F51700' : undefined} bold={isCursor}>
          {isCursor ? '›' : ' '}
        </Text>
      </Box>
      {columns.map(col => {
        const spec = COLUMN_SPECS[col]
        const width = spec.width === 'flex' ? flexWidth : spec.width
        switch (col) {
          case 'repo':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={flashBg} color={baseTextColor} bold={isCursor}>
                  {truncate(pr.repoFullName, width)}
                </Text>
              </Cell>
            )
          case 'number':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={flashBg} color={baseTextColor} bold={isCursor}>
                  {truncate(`#${String(pr.number)}`, width)}
                </Text>
              </Cell>
            )
          case 'title':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={flashBg} color={titleColor} bold={isCursor && !pr.isDraft}>
                  {truncate(cleanTitle(pr.title), width)}
                </Text>
              </Cell>
            )
          case 'ci': {
            const g = ciGlyph(pr.ciState)
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={flashBg} color={g.color} bold={isCursor}>
                  {truncate(g.char, width)}
                </Text>
              </Cell>
            )
          }
          case 'review': {
            const g = reviewGlyph(pr.reviewDecision, pr.reviewRequestCount)
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={flashBg} color={g.color} bold={isCursor}>
                  {truncate(g.char, width)}
                </Text>
              </Cell>
            )
          }
          case 'merge': {
            const g = mergeGlyph(pr.mergeable, pr.mergeStateStatus, pr.isDraft)
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={flashBg} color={g.color} bold={isCursor}>
                  {truncate(g.char, width)}
                </Text>
              </Cell>
            )
          }
          case 'age':
            return (
              <Cell key={col} width={width}>
                <Text
                  backgroundColor={flashBg}
                  color={stale ? 'red' : baseTextColor}
                  bold={stale || isCursor}
                >
                  {truncate(`${String(ageDays)}d`, width)}
                </Text>
              </Cell>
            )
          case 'updated':
            return (
              <Cell key={col} width={width}>
                <Text backgroundColor={flashBg} color={baseTextColor} bold={isCursor}>
                  {truncate(relativeTime(pr.updatedAt, now), width)}
                </Text>
              </Cell>
            )
        }
      })}
    </Box>
  )
}

/**
 * Row-level memo: skip re-render if the displayed strings would be identical.
 * Crucially, we compare the *rendered* relative-time string (e.g. "23h ago"), not
 * the raw `now` number. That means a 1Hz clock tick produces no row redraws unless
 * a row actually crossed a time boundary — which is what eliminates flicker.
 */
const PRRow = React.memo(PRRowImpl, (prev, next) => {
  if (prev.isCursor !== next.isCursor) return false
  if (prev.flashing !== next.flashing) return false
  if (prev.flexWidth !== next.flexWidth) return false
  if (prev.columns !== next.columns) return false
  const a = prev.pr
  const b = next.pr
  if (a.id !== b.id) return false
  if (a.title !== b.title) return false
  if (a.ciState !== b.ciState) return false
  if (a.reviewDecision !== b.reviewDecision) return false
  if (a.mergeable !== b.mergeable) return false
  if (a.mergeStateStatus !== b.mergeStateStatus) return false
  if (a.isDraft !== b.isDraft) return false
  if (a.reviewRequestCount !== b.reviewRequestCount) return false
  // Time-derived strings: only re-render when the *displayed* relative-time
  // string actually changes (e.g. "59s ago" → "1m ago"). Same `now` clock tick
  // that doesn't cross a boundary is a no-op.
  if (relativeTime(a.updatedAt, prev.now) !== relativeTime(b.updatedAt, next.now)) return false
  if (daysSince(a.createdAt, prev.now) !== daysSince(b.createdAt, next.now)) return false
  return true
})

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
