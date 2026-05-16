import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadConfig } from '@/config/loader.ts'
import { ConfigSchema, DEFAULT_CONFIG } from '@/config/schema.ts'

describe('ConfigSchema', () => {
  it('accepts the default config', () => {
    const parsed = ConfigSchema.parse(DEFAULT_CONFIG)
    expect(parsed.defaultPreset).toBe('work')
    expect(parsed.presets.work?.filters).toHaveLength(1)
  })

  it('rejects intervals below 5s', () => {
    expect(() => ConfigSchema.parse({ ...DEFAULT_CONFIG, indexIntervalMs: 1000 })).toThrow()
  })

  it('rejects presets with no filters', () => {
    expect(() =>
      ConfigSchema.parse({
        ...DEFAULT_CONFIG,
        presets: { bad: { label: 'B', filters: [] } },
      })
    ).toThrow()
  })

  it('rejects unknown column keys', () => {
    expect(() => ConfigSchema.parse({ ...DEFAULT_CONFIG, columns: ['nope'] })).toThrow()
  })
})

describe('loadConfig', () => {
  it('writes default config when file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prd-cfg-'))
    const path = join(dir, 'config.json')
    const result = await loadConfig(path)
    expect(result.createdDefault).toBe(true)
    expect(result.config.defaultPreset).toBe('work')
    const written = await readFile(path, 'utf8')
    expect(JSON.parse(written)).toMatchObject({ defaultPreset: 'work' })
  })

  it('loads an existing valid config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prd-cfg-'))
    const path = join(dir, 'config.json')
    await mkdir(dir, { recursive: true })
    const custom = {
      ...DEFAULT_CONFIG,
      indexIntervalMs: 30000,
      defaultPreset: 'personal',
    }
    await writeFile(path, JSON.stringify(custom), 'utf8')
    const result = await loadConfig(path)
    expect(result.createdDefault).toBe(false)
    expect(result.config.indexIntervalMs).toBe(30000)
    expect(result.config.defaultPreset).toBe('personal')
  })

  it('throws on invalid config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prd-cfg-'))
    const path = join(dir, 'config.json')
    await writeFile(path, JSON.stringify({ indexIntervalMs: 100 }), 'utf8')
    await expect(loadConfig(path)).rejects.toThrow()
  })
})
