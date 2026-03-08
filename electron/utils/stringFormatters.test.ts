import { describe, it, expect } from 'vitest'
import { snakeToTitleCase, formatRegionTitle, sanitizeServerName } from './stringFormatters'

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
  it('delegates to snakeToTitleCase', () => {
    expect(formatRegionTitle('oak_village')).toBe('Oak Village')
    expect(formatRegionTitle('heart_of_warriotos')).toBe('Heart of Warriotos')
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
