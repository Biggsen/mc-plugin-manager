import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { comparePmPluginFolders } from './comparePmPluginFolders'
import type { PmGeneratedEntry } from './pmGeneratedPaths'

const tabEntry: PmGeneratedEntry = { id: 'tab', label: 'TAB', relativePath: 'TAB/config.yml' }

describe('comparePmPluginFolders', () => {
  it('treats files as identical when only the mc-plugin-manager header line differs', () => {
    const a = mkdtempSync(join(tmpdir(), 'pm-l-'))
    const b = mkdtempSync(join(tmpdir(), 'pm-r-'))
    mkdirSync(join(a, 'TAB'), { recursive: true })
    mkdirSync(join(b, 'TAB'), { recursive: true })
    const body = 'TimeBook: 900\nBookChronologicalOrder: true\n'
    writeFileSync(
      join(a, 'TAB', 'config.yml'),
      '# mc-plugin-manager: generator-version=008; generated-at=2026-03-25T16:22:09.249Z; profile=p; plugin=tab; build-id=build-1\n' +
        body,
      'utf-8'
    )
    writeFileSync(
      join(b, 'TAB', 'config.yml'),
      '# mc-plugin-manager: generator-version=009; generated-at=2026-03-25T17:29:59.776Z; profile=p; plugin=tab; build-id=build-2\n' +
        body,
      'utf-8'
    )
    const r = comparePmPluginFolders(a, b, [tabEntry])
    expect(r.files[0].status).toBe('identical')
    expect(r.summary.identical).toBe(1)
  })

  it('marks identical YAML', () => {
    const a = mkdtempSync(join(tmpdir(), 'pm-l-'))
    const b = mkdtempSync(join(tmpdir(), 'pm-r-'))
    mkdirSync(join(a, 'TAB'), { recursive: true })
    mkdirSync(join(b, 'TAB'), { recursive: true })
    writeFileSync(join(a, 'TAB', 'config.yml'), 'x: 1\n', 'utf-8')
    writeFileSync(join(b, 'TAB', 'config.yml'), 'x: 1\n', 'utf-8')
    const r = comparePmPluginFolders(a, b, [tabEntry])
    expect(r.files).toHaveLength(1)
    expect(r.files[0].status).toBe('identical')
    expect(r.summary.identical).toBe(1)
  })

  it('marks different YAML with unified diff', () => {
    const a = mkdtempSync(join(tmpdir(), 'pm-l-'))
    const b = mkdtempSync(join(tmpdir(), 'pm-r-'))
    mkdirSync(join(a, 'TAB'), { recursive: true })
    mkdirSync(join(b, 'TAB'), { recursive: true })
    writeFileSync(join(a, 'TAB', 'config.yml'), 'x: 1\n', 'utf-8')
    writeFileSync(join(b, 'TAB', 'config.yml'), 'x: 2\n', 'utf-8')
    const r = comparePmPluginFolders(a, b, [tabEntry])
    expect(r.files[0].status).toBe('different')
    expect(r.files[0].unifiedDiff).toContain('@@')
    expect(r.summary.different).toBe(1)
  })

  it('marks missing on one side', () => {
    const a = mkdtempSync(join(tmpdir(), 'pm-l-'))
    const b = mkdtempSync(join(tmpdir(), 'pm-r-'))
    mkdirSync(join(a, 'TAB'), { recursive: true })
    writeFileSync(join(a, 'TAB', 'config.yml'), 'x: 1\n', 'utf-8')
    const r = comparePmPluginFolders(a, b, [tabEntry])
    expect(r.files[0].status).toBe('missing_right')
    expect(r.summary.missingRight).toBe(1)
  })
})
