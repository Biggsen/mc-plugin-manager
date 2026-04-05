import { describe, it, expect } from 'vitest'
import {
  sanitizeWorldGuardWorldFolder,
  getWorldGuardRegionsPropagatedRelativePath,
} from './worldGuardRegionsPaths'

describe('sanitizeWorldGuardWorldFolder', () => {
  it('defaults empty to world', () => {
    expect(sanitizeWorldGuardWorldFolder('')).toBe('world')
    expect(sanitizeWorldGuardWorldFolder('   ')).toBe('world')
  })

  it('strips path injection characters', () => {
    expect(sanitizeWorldGuardWorldFolder('../../../etc')).toBe('etc')
    expect(sanitizeWorldGuardWorldFolder('my-world_nether')).toBe('my-world_nether')
  })
})

describe('getWorldGuardRegionsPropagatedRelativePath', () => {
  it('uses sanitized folder', () => {
    expect(getWorldGuardRegionsPropagatedRelativePath('world')).toBe('WorldGuard/worlds/world/regions.yml')
    expect(getWorldGuardRegionsPropagatedRelativePath('../evil')).toBe('WorldGuard/worlds/evil/regions.yml')
  })
})
