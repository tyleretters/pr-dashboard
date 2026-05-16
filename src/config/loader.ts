import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { ConfigSchema, DEFAULT_CONFIG } from './schema.ts'
import type { Config } from './schema.ts'

export const CONFIG_PATH = join(homedir(), '.config', 'pr-dashboard', 'config.json')

export interface LoadedConfig {
  config: Config
  path: string
  createdDefault: boolean
}

export const loadConfig = async (path: string = CONFIG_PATH): Promise<LoadedConfig> => {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const config = ConfigSchema.parse(parsed)
    return { config, path, createdDefault: false }
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf8')
      return { config: DEFAULT_CONFIG, path, createdDefault: true }
    }
    throw err
  }
}

export const saveConfig = async (config: Config, path: string = CONFIG_PATH): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', 'utf8')
}
