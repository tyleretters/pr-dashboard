import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { execFile } from 'node:child_process'
import { Box, Text, useApp, useInput, useStdout } from 'ink'

import { saveConfig } from '@/config/loader.ts'
import { buildScopes, scopeToFilter } from '@/config/schema.ts'
import { cleanTitle } from '@/format/status.ts'
import { startScheduler } from '@/poll/scheduler.ts'
import { FailedChecks } from '@/ui/FailedChecks.tsx'
import { FilterBar } from '@/ui/FilterBar.tsx'
import { Header } from '@/ui/Header.tsx'
import { PresetTabs } from '@/ui/PresetTabs.tsx'
import { PRTable } from '@/ui/PRTable.tsx'
import { SettingsPanel } from '@/ui/SettingsPanel.tsx'
import { StatusFooter } from '@/ui/StatusFooter.tsx'
import type { Config, Scope } from '@/config/schema.ts'
import type { ViewerScopes } from '@/github/queries/orgsQuery.ts'
import type { DetailedPR } from '@/github/types.ts'
import type { PollTick, SchedulerHandle } from '@/poll/scheduler.ts'
import type { RateLimit } from '@/github/client.ts'

interface Props {
  config: Config
  configPath: string
  viewer: ViewerScopes
  firstRun: boolean
}

const FLASH_MS = 1200

export const App: React.FC<Props> = ({ config: initialConfig, configPath, viewer, firstRun }) => {
  const { exit } = useApp()
  const { stdout } = useStdout()

  const [config, setConfig] = useState(initialConfig)
  const initialScopes = useMemo(
    () => buildScopes(viewer.login, viewer.orgs, initialConfig.enabledScopes, initialConfig.disabledScopes),
    [viewer, initialConfig.enabledScopes, initialConfig.disabledScopes]
  )
  const [scopes, setScopes] = useState(initialScopes)
  const enabledScopes = useMemo(() => scopes.filter(s => s.enabled), [scopes])
  const [activeKey, setActiveKey] = useState<string | null>(enabledScopes[0]?.key ?? null)

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
  // Auto-open settings on the very first launch so the user picks scopes
  // before the dashboard starts polling.
  const [settingsMode, setSettingsMode] = useState(firstRun)
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

  // Boot/refresh scheduler whenever the active scope changes.
  useEffect(() => {
    if (!activeKey) return
    const scope = scopes.find(s => s.key === activeKey)
    if (!scope) return
    setLoading(true)
    setError(null)
    const handle = startScheduler({
      scope: { presetKey: scope.key, filters: [scopeToFilter(scope)] },
      indexIntervalMs: config.indexIntervalMs,
      detailBatchSize: config.detailMaxBatchSize,
      onTick: handleTick,
    })
    schedulerRef.current = handle
    return () => {
      handle.stop()
    }
  }, [activeKey, config.indexIntervalMs, config.detailMaxBatchSize, handleTick, scopes])

  // Tick the "now" clock so relative-time strings update visibly. 1Hz is enough —
  // the UI only displays whole seconds, and a faster tick triggers re-renders
  // that can cause terminal flicker.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])

  // Track terminal size and react to resizes so the sticky footer stays pinned.
  const [terminalSize, setTerminalSize] = useState({ width: stdout.columns ?? 120, height: stdout.rows ?? 40 })
  useEffect(() => {
    const onResize = (): void => {
      setTerminalSize({ width: stdout.columns ?? 120, height: stdout.rows ?? 40 })
    }
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

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

  const switchScope = useCallback(
    (key: string) => {
      if (key === activeKey) return
      const scope = scopes.find(s => s.key === key && s.enabled)
      if (!scope) return
      setActiveKey(key)
      setPrs([])
      setCursor(0)
      setShowChecks(false)
    },
    [activeKey, scopes]
  )

  const handleSettingsSave = useCallback(
    (next: Scope[]) => {
      setScopes(next)
      const enabledKeys = next.filter(s => s.enabled).map(s => s.key)
      const disabledKeys = next.filter(s => !s.enabled).map(s => s.key)
      const nextConfig: Config = { ...config, enabledScopes: enabledKeys, disabledScopes: disabledKeys }
      setConfig(nextConfig)
      void saveConfig(nextConfig, configPath)
      // If the active scope got disabled, jump to the first enabled scope.
      const stillActive = next.find(s => s.key === activeKey && s.enabled)
      if (!stillActive) {
        const fallback = next.find(s => s.enabled)
        setActiveKey(fallback?.key ?? null)
        setPrs([])
        setCursor(0)
      }
      setSettingsMode(false)
    },
    [config, configPath, activeKey]
  )

  useInput((input, key) => {
    if (settingsMode) return // settings panel handles its own keys
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
    if (input === 's') {
      setSettingsMode(true)
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
    if (key.return || input === 'o') {
      const focused = filtered[cursor]
      if (focused) {
        execFile('open', [focused.url], () => {
          /* fire and forget */
        })
      }
      return
    }
    if (input === 'x') {
      setShowChecks(s => !s)
      return
    }
    const presetIndex = Number.parseInt(input, 10)
    if (!Number.isNaN(presetIndex) && presetIndex >= 1 && presetIndex <= enabledScopes.length) {
      const target = enabledScopes[presetIndex - 1]
      if (target) switchScope(target.key)
    }
  })

  const tabs = enabledScopes.map(s => ({ key: s.key, label: s.label }))
  const activeLabel = enabledScopes.find(s => s.key === activeKey)?.label ?? '—'
  const terminalWidth = terminalSize.width
  const focused = filtered[cursor] ?? null

  if (enabledScopes.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="#F51700" bold>
            No scopes enabled.
          </Text>
        </Box>
        <Text>Press </Text>
        <Text bold>s</Text>
        <Text> to open settings and toggle on at least one scope.</Text>
        {settingsMode ? (
          <SettingsPanel
            scopes={scopes}
            onSave={handleSettingsSave}
            onCancel={() => {
              setSettingsMode(false)
            }}
          />
        ) : null}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Header
        presetLabel={activeLabel}
        presetKey={activeKey ?? ''}
        totalCount={indexedCount}
        visibleCount={filtered.length}
        error={error}
        filterText={filterText}
      />
      <PresetTabs presets={tabs} active={activeKey ?? ''} />
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
      {settingsMode ? (
        <SettingsPanel
          scopes={scopes}
          onSave={handleSettingsSave}
          onCancel={() => {
            setSettingsMode(false)
          }}
        />
      ) : null}
      <StatusFooter lastTickAt={lastTickAt} nextTickAt={nextTickAt} rateLimit={rateLimit} now={now} loading={loading} />
    </Box>
  )
}
