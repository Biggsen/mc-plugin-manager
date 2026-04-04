import { describe, it, expect } from 'vitest'
import {
  snakeToTitleCase,
  formatRegionTitle,
  formatRegionLabel,
  formatStructureTypeLabel,
  sanitizeServerName,
} from './stringFormatters'

describe('snakeToTitleCase', () => {
  it('single word capitalizes', () => {
    expect(snakeToTitleCase('cherrybrook')).toBe('Cherrybrook')
  })

  it('multiple words title-case, keeps "of" lowercase in middle', () => {
    expect(snakeToTitleCase('heart_of_monkvos')).toBe('Heart of Monkvos')
  })

  it('all caps input is normalized', () => {
    expect(snakeToTitleCase('DESERT_RUINS')).toBe('Desert Ruins')
  })

  it('empty string returns empty', () => {
    expect(snakeToTitleCase('')).toBe('')
  })
})

describe('formatRegionTitle', () => {
  it('snake_case to Title Case, keeps "of" lowercase', () => {
    expect(formatRegionTitle('heart_of_monkvos')).toBe('Heart of Monkvos')
  })

  it('single word', () => {
    expect(formatRegionTitle('cherrybrook')).toBe('Cherrybrook')
  })

  it('delegates to snakeToTitleCase for multi-word ids', () => {
    expect(formatRegionTitle('oak_village')).toBe('Oak Village')
    expect(formatRegionTitle('heart_of_warriotos')).toBe('Heart of Warriotos')
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

describe('formatStructureTypeLabel', () => {
  it('title-cases snake_case segments', () => {
    expect(formatStructureTypeLabel('ancient_city')).toBe('Ancient City')
    expect(formatStructureTypeLabel('trail_ruins')).toBe('Trail Ruins')
  })

  it('maps unknown bucket', () => {
    expect(formatStructureTypeLabel('unknown')).toBe('Unknown type')
  })
})

describe('sanitizeServerName', () => {
  it('lowercases and replaces non-alphanumeric with hyphen', () => {
    expect(sanitizeServerName('My Cool Server')).toBe('my-cool-server')
  })

  it('strips special characters (one hyphen per replaced char)', () => {
    expect(sanitizeServerName('Test & Co. (2024)')).toBe('test---co---2024-')
  })

  it('leaves alphanumeric and hyphens', () => {
    expect(sanitizeServerName('Server-01')).toBe('server-01')
  })

  it('empty string returns empty', () => {
    expect(sanitizeServerName('')).toBe('')
  })
})
