import React from 'react'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { render, Text } from 'ink'

import { loadConfig } from './config/loader.ts'
import { fetchViewerScopes } from './github/queries/orgsQuery.ts'
import { GhAuthError, GhMissingError, verifyGhAvailable } from './auth/ghToken.ts'
import { checkForUpdate } from './update/checker.ts'
import { App } from './ui/App.tsx'

// Read name + version from package.json so both --version and the
// update-notifier share a single source of truth — no risk of the
// hardcoded VERSION constant drifting from package.json again.
const here = dirname(fileURLToPath(import.meta.url))
const pkgJsonPath = join(here, '..', 'package.json')
const readPkg = async (): Promise<{ name: string; version: string }> => {
  const raw = await readFile(pkgJsonPath, 'utf8')
  return JSON.parse(raw) as { name: string; version: string }
}

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2)
  const pkg = await readPkg()
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`prd ${pkg.version}\n`)
    return
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(
      [
        'prd - live PR dashboard',
        '',
        'Usage: prd',
        '',
        'Keys:',
        '  1-9      switch scope (orgs / user)',
        '  j/k      move cursor',
        '  enter    open focused PR in browser',
        '  o        open focused PR in browser (alias)',
        '  x        toggle failed-checks inline',
        '  /        filter rows',
        '  r        force refresh',
        '  s        open settings (toggle scopes)',
        '  q        quit',
        '',
        `Config: ~/.config/pr-dashboard/config.json`,
        '',
      ].join('\n')
    )
    return
  }

  try {
    await verifyGhAvailable()
  } catch (err) {
    if (err instanceof GhMissingError || err instanceof GhAuthError) {
      process.stderr.write(`${err.message}\n`)
      process.exit(2)
    }
    throw err
  }

  const { config, path, createdDefault } = await loadConfig()

  // Fetch the viewer's login + org list — runs once on startup so newly
  // joined orgs show up in the next session.
  const viewerResult = await fetchViewerScopes()
  const viewer = viewerResult.data

  const update = checkForUpdate({ name: pkg.name, version: pkg.version })

  // Enter the alternate screen buffer so the dashboard takes over the terminal
  // cleanly and restores the previous scrollback on exit (like vim, less, htop).
  const ALT_SCREEN_ENTER = '\x1b[?1049h\x1b[H'
  const ALT_SCREEN_LEAVE = '\x1b[?1049l'
  const usingTTY = process.stdout.isTTY

  if (usingTTY) process.stdout.write(ALT_SCREEN_ENTER)

  const restore = (): void => {
    if (usingTTY) process.stdout.write(ALT_SCREEN_LEAVE)
  }
  process.on('exit', restore)
  process.on('SIGINT', () => {
    restore()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    restore()
    process.exit(143)
  })

  const { waitUntilExit } = render(
    <App config={config} configPath={path} viewer={viewer} firstRun={createdDefault} update={update} />,
    { exitOnCtrlC: true }
  )
  try {
    await waitUntilExit()
  } finally {
    restore()
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`fatal: ${msg}\n`)
  if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`)
  process.exit(1)
})

const PreflightError: React.FC<{ message: string }> = ({ message }) => <Text color="red">{message}</Text>
export { PreflightError }
