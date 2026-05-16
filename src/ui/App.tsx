import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { execFile } from 'node:child_process'
import { Box, useApp, useInput, useStdout } from 'ink'

import { cleanTitle } from '@/format/status.ts'
import { startScheduler } from '@/poll/scheduler.ts'
import { FailedChecks } from '@/ui/FailedChecks.tsx'
import { FilterBar } from '@/ui/FilterBar.tsx'
import { Header } from '@/ui/Header.tsx'
import { PresetTabs } from '@/ui/PresetTabs.tsx'
import { PRTable } from '@/ui/PRTable.tsx'
import type { Config } from '@/config/schema.ts'
import type { DetailedPR } from '@/github/types.ts'
import type { PollTick, SchedulerHandle } from '@/poll/scheduler.ts'
import type { RateLimit } from '@/github/client.ts'

interface Props {
  config: Config
}

const FLASH_MS = 1200

export const App: React.FC<Props> = ({ config }) => {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const presetKeys = useMemo(() => Object.keys(config.presets), [config.presets])
  const initialPreset = presetKeys.includes(config.defaultPreset) ? config.defaultPreset : presetKeys[0]
  if (!initialPreset) {
    throw new Error('config has no presets defined')
  }

  const [activePreset, setActivePreset] = useState(initialPreset)
  const [prs, setPrs] = useState<DetailedPR[]>([])
  const [indexedCount, setIndexedCount] = useState(0)
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null)
  const [lastTickAt, setLastTickAt] = useState<number | null>(null)
  const [nextTickAt, setNextTickAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [cursor, setCursor] = useState(0)
  const [showChecks, setShowChecks] = useState(false)
  const [filterMode, setFilterMode] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [flashUntil, setFlashUntil] = useState(new Map<string, number>())

  const schedulerRef = useRef<SchedulerHandle | null>(null)

  const handleTick = useCallback(
    (tick: PollTick) => {
      setPrs(tick.prs)
      setIndexedCount(tick.indexedCount)
      setRateLimit(tick.rateLimit)
      setLastTickAt(tick.finishedAt)
      setNextTickAt(tick.finishedAt + config.indexIntervalMs)
      setLoading(false)
      setError(tick.error ? tick.error.message : null)
      if (tick.changedIds.size > 0) {
        const until = Date.now() + FLASH_MS
        setFlashUntil(prev => {
          const next = new Map(prev)
          for (const id of tick.changedIds) next.set(id, until)
          return next
        })
      }
    },
    [config.indexIntervalMs]
  )

  // Boot scheduler with the active preset
  useEffect(() => {
    const preset = config.presets[activePreset]
    if (!preset) return
    setLoading(true)
    setError(null)
    const handle = startScheduler({
      scope: { presetKey: activePreset, filters: preset.filters },
      indexIntervalMs: config.indexIntervalMs,
      detailBatchSize: config.detailMaxBatchSize,
      onTick: handleTick,
    })
    schedulerRef.current = handle
    return () => {
      handle.stop()
    }
  }, [activePreset, config, handleTick])

  // Tick the "now" clock so relative-time strings update visibly
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 500)
    return () => {
      clearInterval(id)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!filterText) return prs
    const needle = filterText.toLowerCase()
    return prs.filter(pr => {
      return (
        pr.repoFullName.toLowerCase().includes(needle) ||
        cleanTitle(pr.title).toLowerCase().includes(needle) ||
        (pr.author?.toLowerCase().includes(needle) ?? false) ||
        String(pr.number).includes(needle)
      )
    })
  }, [prs, filterText])

  useEffect(() => {
    if (cursor >= filtered.length) {
      setCursor(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, cursor])

  const switchPreset = useCallback(
    (key: string) => {
      if (key === activePreset || !config.presets[key]) return
      setActivePreset(key)
      setPrs([])
      setCursor(0)
      setShowChecks(false)
    },
    [activePreset, config.presets]
  )

  useInput((input, key) => {
    if (filterMode) {
      if (key.escape) {
        setFilterMode(false)
        setFilterText('')
      }
      return
    }
    if (key.ctrl && input === 'c') {
      exit()
      return
    }
    if (input === 'q') {
      exit()
      return
    }
    if (input === '/') {
      setFilterMode(true)
      return
    }
    if (input === 'r') {
      schedulerRef.current?.forceRefresh()
      setLoading(true)
      return
    }
    if (input === 'j' || key.downArrow) {
      setCursor(c => Math.min(c + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (input === 'k' || key.upArrow) {
      setCursor(c => Math.max(0, c - 1))
      return
    }
    if (key.return) {
      setShowChecks(s => !s)
      return
    }
    if (input === 'o') {
      const focused = filtered[cursor]
      if (focused) {
        execFile('open', [focused.url], () => {
          /* fire and forget */
        })
      }
      return
    }
    if (input === 'c') {
      const focused = filtered[cursor]
      if (focused) {
        const child = execFile('pbcopy', () => {
          /* fire and forget */
        })
        child.stdin?.end(focused.url)
      }
      return
    }
    const presetIndex = Number.parseInt(input, 10)
    if (!Number.isNaN(presetIndex) && presetIndex >= 1 && presetIndex <= presetKeys.length) {
      const key = presetKeys[presetIndex - 1]
      if (key) switchPreset(key)
    }
  })

  const presetTabs = presetKeys.map(k => {
    const p = config.presets[k]
    return { key: k, label: p?.label ?? k }
  })
  const activeLabel = config.presets[activePreset]?.label ?? activePreset
  const terminalWidth = stdout.columns ?? 120
  const focused = filtered[cursor] ?? null

  return (
    <Box flexDirection="column">
      <Header
        presetLabel={activeLabel}
        presetKey={activePreset}
        totalCount={indexedCount}
        visibleCount={filtered.length}
        lastTickAt={lastTickAt}
        nextTickAt={nextTickAt}
        rateLimit={rateLimit}
        now={now}
        loading={loading}
        error={error}
        filterText={filterText}
      />
      <PresetTabs presets={presetTabs} active={activePreset} />
      <PRTable prs={filtered} columns={config.columns} cursor={cursor} now={now} flashUntil={flashUntil} terminalWidth={terminalWidth} />
      {showChecks ? <FailedChecks pr={focused} /> : null}
      {filterMode ? (
        <FilterBar
          value={filterText}
          onChange={setFilterText}
          onSubmit={() => {
            setFilterMode(false)
          }}
        />
      ) : null}
    </Box>
  )
}
