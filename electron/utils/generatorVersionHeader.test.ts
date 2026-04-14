import { describe, it, expect } from 'vitest'
import {
  prependGeneratorVersionHeader,
  stripGeneratorVersionCommentLines,
  formatGeneratorVersionDisplay,
  sanitizeBuildNoteForHeader,
  GENERATOR_VERSION_HEADER_PREFIX,
} from './generatorVersionHeader'

describe('formatGeneratorVersionDisplay', () => {
  it('zero-pads through 999', () => {
    expect(formatGeneratorVersionDisplay(1)).toBe('001')
    expect(formatGeneratorVersionDisplay(999)).toBe('999')
  })

  it('does not pad past 999', () => {
    expect(formatGeneratorVersionDisplay(1000)).toBe('1000')
  })

  it('rejects non-positive', () => {
    expect(() => formatGeneratorVersionDisplay(0)).toThrow()
    expect(() => formatGeneratorVersionDisplay(1.5)).toThrow()
  })
})

describe('prependGeneratorVersionHeader', () => {
  const baseOpts = {
    plugin: 'tab' as const,
    profileId: 'charidh-main',
    buildId: 'build-1742662200123',
    nextVersion: 7,
    generatedAt: '2026-03-22T16:30:00.000Z',
  }

  it('builds the spec-shaped line and places it on line 1', () => {
    const out = prependGeneratorVersionHeader('header-footer:\n  enabled: true\n', baseOpts)
    const lines = out.split('\n')
    expect(lines[0]).toBe(
      `${GENERATOR_VERSION_HEADER_PREFIX} generator-version=007; generated-at=2026-03-22T16:30:00.000Z; profile=charidh-main; plugin=tab; build-id=build-1742662200123`
    )
    expect(lines[1]).toBe('header-footer:')
  })

  it('handles empty body (valid comment-only start for YAML)', () => {
    const out = prependGeneratorVersionHeader('', baseOpts)
    expect(out).toMatch(new RegExp(`^${GENERATOR_VERSION_HEADER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `))
    expect(out.endsWith('\n')).toBe(true)
    expect(out.split('\n').length).toBe(2)
  })

  it('adds emit=test and build-note when provided', () => {
    const out = prependGeneratorVersionHeader('x: 1\n', {
      ...baseOpts,
      testEmit: true,
      buildNote: 'TAB spacing',
    })
    const line = out.split('\n')[0]
    expect(line).toContain('emit=test')
    expect(line).toContain('build-note=TAB spacing')
  })

  it('omits build-note when empty on test emit', () => {
    const out = prependGeneratorVersionHeader('x: 1\n', { ...baseOpts, testEmit: true })
    expect(out.split('\n')[0]).toContain('emit=test')
    expect(out.split('\n')[0]).not.toContain('build-note=')
  })
})

describe('sanitizeBuildNoteForHeader', () => {
  it('replaces semicolons and newlines', () => {
    expect(sanitizeBuildNoteForHeader('a;b\nc')).toBe('a,b c')
  })
})

describe('stripGeneratorVersionCommentLines', () => {
  it('removes one leading stamp line', () => {
    const inner = 'foo: bar\n'
    const raw = `${GENERATOR_VERSION_HEADER_PREFIX} generator-version=001; plugin=tab\n${inner}`
    expect(stripGeneratorVersionCommentLines(raw)).toBe(inner)
  })

  it('removes consecutive stamp lines', () => {
    const raw = `${GENERATOR_VERSION_HEADER_PREFIX} a=1\n${GENERATOR_VERSION_HEADER_PREFIX} b=2\nx: 1\n`
    expect(stripGeneratorVersionCommentLines(raw)).toBe('x: 1\n')
  })

  it('leaves content unchanged when no stamp', () => {
    const raw = 'foo: bar\n'
    expect(stripGeneratorVersionCommentLines(raw)).toBe(raw)
  })

  it('preserves original when first line is a different comment', () => {
    const raw = '# other\nfoo: bar\n'
    expect(stripGeneratorVersionCommentLines(raw)).toBe(raw)
  })
})
