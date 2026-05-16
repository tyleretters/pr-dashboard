import { describe, expect, it } from 'vitest'

import { ciGlyph, cleanTitle, mergeGlyph, reviewGlyph } from '../src/format/status.ts'

describe('ciGlyph', () => {
  it('renders success as green check', () => {
    expect(ciGlyph('SUCCESS')).toEqual({ char: '✓', color: 'green' })
  })
  it('renders failure as red cross', () => {
    expect(ciGlyph('FAILURE')).toEqual({ char: '✗', color: 'red' })
  })
  it('renders error like failure', () => {
    expect(ciGlyph('ERROR')).toEqual({ char: '✗', color: 'red' })
  })
  it('renders pending as yellow dot', () => {
    expect(ciGlyph('PENDING')).toEqual({ char: '●', color: 'yellow' })
  })
  it('renders expected as yellow dot', () => {
    expect(ciGlyph('EXPECTED')).toEqual({ char: '●', color: 'yellow' })
  })
  it('renders null as dim dash', () => {
    expect(ciGlyph(null)).toEqual({ char: '–', color: 'gray' })
  })
})

describe('reviewGlyph', () => {
  it('renders approved as green check', () => {
    expect(reviewGlyph('APPROVED', 0)).toEqual({ char: '✓', color: 'green' })
  })
  it('renders changes-requested as red cross', () => {
    expect(reviewGlyph('CHANGES_REQUESTED', 0)).toEqual({ char: '✗', color: 'red' })
  })
  it('renders review-required as yellow question', () => {
    expect(reviewGlyph('REVIEW_REQUIRED', 0)).toEqual({ char: '?', color: 'yellow' })
  })
  it('treats pending review requests as yellow question even without decision', () => {
    expect(reviewGlyph(null, 2)).toEqual({ char: '?', color: 'yellow' })
  })
  it('renders no reviews and no requests as dim middot', () => {
    expect(reviewGlyph(null, 0)).toEqual({ char: '·', color: 'gray' })
  })
})

describe('mergeGlyph', () => {
  it('renders drafts as gray D regardless of mergeability', () => {
    expect(mergeGlyph('MERGEABLE', 'CLEAN', true)).toEqual({ char: 'D', color: 'gray' })
  })
  it('renders conflicts as red cross', () => {
    expect(mergeGlyph('CONFLICTING', 'DIRTY', false)).toEqual({ char: '✗', color: 'red' })
  })
  it('renders DIRTY status as red cross even when mergeable says unknown', () => {
    expect(mergeGlyph('UNKNOWN', 'DIRTY', false)).toEqual({ char: '✗', color: 'red' })
  })
  it('renders CLEAN as green check', () => {
    expect(mergeGlyph('MERGEABLE', 'CLEAN', false)).toEqual({ char: '✓', color: 'green' })
  })
  it('renders BLOCKED as yellow warning', () => {
    expect(mergeGlyph('MERGEABLE', 'BLOCKED', false)).toEqual({ char: '⚠', color: 'yellow' })
  })
  it('renders BEHIND as yellow warning', () => {
    expect(mergeGlyph('MERGEABLE', 'BEHIND', false)).toEqual({ char: '⚠', color: 'yellow' })
  })
  it('renders UNSTABLE as yellow warning', () => {
    expect(mergeGlyph('MERGEABLE', 'UNSTABLE', false)).toEqual({ char: '⚠', color: 'yellow' })
  })
  it('falls through unknown statuses to dim middot', () => {
    expect(mergeGlyph('UNKNOWN', 'UNKNOWN', false)).toEqual({ char: '·', color: 'gray' })
  })
})

describe('cleanTitle', () => {
  it('strips feat: prefix', () => {
    expect(cleanTitle('feat: add new column')).toBe('add new column')
  })
  it('strips fix(scope): prefix', () => {
    expect(cleanTitle('fix(scheduler): handle empty index')).toBe('handle empty index')
  })
  it('strips chore!: breaking-change prefix', () => {
    expect(cleanTitle('chore!: drop node 20')).toBe('drop node 20')
  })
  it('leaves jira-key prefixes alone', () => {
    expect(cleanTitle('SHOP-1383 Trigger preview')).toBe('SHOP-1383 Trigger preview')
  })
  it('leaves non-conventional titles alone', () => {
    expect(cleanTitle('Replace manual hash coordination')).toBe('Replace manual hash coordination')
  })
})
