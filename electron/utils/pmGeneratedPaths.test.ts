import { describe, it, expect } from 'vitest'
import { getPmGeneratedEntries } from './pmGeneratedPaths'

describe('getPmGeneratedEntries', () => {
  it('includes EssentialsX propagated config and rules files', () => {
    const { entries } = getPmGeneratedEntries()
    const byId = Object.fromEntries(
      entries.map((e) => [e.id, e.relativePath.replace(/\\/g, '/')])
    )

    expect(byId['essentials-config']).toBe('essentials/config.yml')
    expect(byId['essentials-rules']).toBe('essentials/rules.txt')
  })
})
