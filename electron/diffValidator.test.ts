import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { prependGeneratorVersionHeader } from './utils/generatorVersionHeader'
import { validateTABDiff } from './diffValidator'

describe('diffValidator generator header strip', () => {
  it('TAB diff passes when only the generator stamp differs from template', () => {
    const tabTemplate = path.join(
      process.cwd(),
      'reference',
      'plugin config files',
      'to be bundled',
      'tab-config.yml'
    )
    const templateBody = readFileSync(tabTemplate, 'utf-8')
    expect(templateBody.trimStart().startsWith('# mc-plugin-manager:')).toBe(false)

    const withHeader = prependGeneratorVersionHeader(templateBody, {
      plugin: 'tab',
      profileId: 'test-profile',
      buildId: 'build-999',
      nextVersion: 3,
      generatedAt: '2026-01-01T00:00:00.000Z',
    })

    const result = validateTABDiff(tabTemplate, withHeader)
    expect(result.valid, result.error).toBe(true)
  })
})
