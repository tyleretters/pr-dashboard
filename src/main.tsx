import React from 'react'
import { render, Text } from 'ink'

import { loadConfig } from '@/config/loader.ts'
import { GhAuthError, GhMissingError, verifyGhAvailable } from '@/auth/ghToken.ts'
import { App } from '@/ui/App.tsx'

const VERSION = '0.1.0'

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2)
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`prd ${VERSION}\n`)
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
        '  1-9      switch preset',
        '  j/k      move cursor',
        '  enter    toggle failed-checks inline',
        '  o        open focused PR in browser',
        '  c        copy focused PR URL',
        '  /        filter rows',
        '  r        force refresh',
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
  if (createdDefault) {
    process.stdout.write(`Wrote default config to ${path}\n`)
  }

  const { waitUntilExit } = render(<App config={config} />, { exitOnCtrlC: true })
  await waitUntilExit()
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`fatal: ${msg}\n`)
  if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`)
  process.exit(1)
})

const PreflightError: React.FC<{ message: string }> = ({ message }) => <Text color="red">{message}</Text>
export { PreflightError }
