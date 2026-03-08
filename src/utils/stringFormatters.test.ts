import { describe, it, expect } from 'vitest'
import { formatRegionTitle, formatRegionLabel } from './stringFormatters'

describe('formatRegionTitle', () => {
  it('snake_case to Title Case, keeps "of" lowercase', () => {
    expect(formatRegionTitle('heart_of_monkvos')).toBe('Heart of Monkvos')
  })

  it('single word', () => {
    expect(formatRegionTitle('cherrybrook')).toBe('Cherrybrook')
  })
})

describe('formatRegionLabel', () => {
  it('uses displayNameOverride when set', () => {
    expect(
      formatRegionLabel({
        id: 'snake_region',
        discover: { displayNameOverride: 'Custom Name' },
      })
    ).toBe('Custom Name')
  })

  it('falls back to formatRegionTitle(id) when no override', () => {
    expect(formatRegionLabel({ id: 'desert_ruins' })).toBe('Desert Ruins')
  })

  it('handles missing discover', () => {
    expect(formatRegionLabel({ id: 'oak_village' })).toBe('Oak Village')
  })
})
