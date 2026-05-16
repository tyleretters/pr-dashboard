import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadConfig, saveConfig } from '../src/config/loader.ts'
import { buildScopes, ConfigSchema, DEFAULT_CONFIG, scopeToFilter } from '../src/config/schema.ts'

describe('ConfigSchema', () => {
  it('accepts the default config', () => {
    const parsed = ConfigSchema.parse(DEFAULT_CONFIG)
    expect(parsed.enabledScopes).toEqual([])
    expect(parsed.disabledScopes).toEqual([])
  })

  it('rejects intervals below 5s', () => {
    expect(() => ConfigSchema.parse({ ...DEFAULT_CONFIG, indexIntervalMs: 1000 })).toThrow()
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
    expect(result.config.enabledScopes).toEqual([])
    const written = await readFile(path, 'utf8')
    expect(JSON.parse(written)).toMatchObject({ enabledScopes: [] })
  })

  it('loads an existing valid config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prd-cfg-'))
    const path = join(dir, 'config.json')
    await mkdir(dir, { recursive: true })
    const custom = {
      ...DEFAULT_CONFIG,
      indexIntervalMs: 30000,
      enabledScopes: ['discogs'],
    }
    await writeFile(path, JSON.stringify(custom), 'utf8')
    const result = await loadConfig(path)
    expect(result.createdDefault).toBe(false)
    expect(result.config.indexIntervalMs).toBe(30000)
    expect(result.config.enabledScopes).toEqual(['discogs'])
  })

  it('saves and reloads round-trip', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prd-cfg-'))
    const path = join(dir, 'config.json')
    const next = { ...DEFAULT_CONFIG, enabledScopes: ['a', 'b'], disabledScopes: ['c'] }
    await saveConfig(next, path)
    const reloaded = await loadConfig(path)
    expect(reloaded.config.enabledScopes).toEqual(['a', 'b'])
    expect(reloaded.config.disabledScopes).toEqual(['c'])
  })

  it('throws on invalid config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prd-cfg-'))
    const path = join(dir, 'config.json')
    await writeFile(path, JSON.stringify({ indexIntervalMs: 100 }), 'utf8')
    await expect(loadConfig(path)).rejects.toThrow()
  })
})

describe('buildScopes', () => {
  it('defaults newly-discovered scopes to enabled', () => {
    const scopes = buildScopes('tyleretters', ['discogs', 'northern-information'], [], [])
    expect(scopes.every(s => s.enabled)).toBe(true)
    expect(scopes.map(s => s.key)).toEqual(['discogs', 'northern-information', 'tyleretters'])
  })

  it('alphabetizes by key', () => {
    const scopes = buildScopes('zara', ['acme', 'lambda'], [], [])
    expect(scopes.map(s => s.key)).toEqual(['acme', 'lambda', 'zara'])
  })

  it('respects disabled list', () => {
    const scopes = buildScopes('tyleretters', ['discogs', 'acme'], ['tyleretters', 'discogs'], ['acme'])
    expect(scopes.find(s => s.key === 'acme')?.enabled).toBe(false)
    expect(scopes.find(s => s.key === 'discogs')?.enabled).toBe(true)
  })

  it('marks the user scope', () => {
    const scopes = buildScopes('tyleretters', ['acme'], [], [])
    expect(scopes.find(s => s.key === 'tyleretters')?.isUser).toBe(true)
    expect(scopes.find(s => s.key === 'acme')?.isUser).toBe(false)
  })

  it('drops scopes that fell out of viewer discovery', () => {
    const scopes = buildScopes('me', ['stillhere'], ['me', 'stillhere', 'gone'], [])
    expect(scopes.map(s => s.key)).toEqual(['me', 'stillhere'])
  })

  it('dedupes when user login somehow matches an org name', () => {
    const scopes = buildScopes('shared', ['shared', 'other'], [], [])
    expect(scopes.map(s => s.key)).toEqual(['other', 'shared'])
    expect(scopes.find(s => s.key === 'shared')?.isUser).toBe(true)
  })
})

describe('scopeToFilter', () => {
  it('uses user: qualifier for the authenticated user', () => {
    const filter = scopeToFilter({ key: 'tyleretters', label: 'tyleretters', isUser: true, enabled: true })
    expect(filter).toBe('is:open is:pr involves:@me user:tyleretters archived:false')
  })

  it('uses org: qualifier for organizations', () => {
    const filter = scopeToFilter({ key: 'discogs', label: 'discogs', isUser: false, enabled: true })
    expect(filter).toBe('is:open is:pr involves:@me org:discogs archived:false')
  })
})
