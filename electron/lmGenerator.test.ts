import { describe, it, expect } from 'vitest'
import { generateOwnedLMRules } from './lmGenerator'

import type { RegionRecord } from './types'

function region(
  id: string,
  kind: 'region' | 'village' | 'heart',
  world: 'overworld' | 'nether' | 'end' = 'overworld'
): RegionRecord {
  const recipeId =
    kind === 'village' ? 'region' : kind === 'heart' ? (world === 'nether' ? 'nether_heart' : 'heart') : world === 'nether' ? 'nether_region' : 'region'
  return {
    world,
    id,
    kind,
    discover: { method: 'on_enter', recipeId: recipeId as RegionRecord['discover']['recipeId'] },
  }
}

describe('generateOwnedLMRules', () => {
  it('empty regions returns no villages rule and empty regionBandRules', () => {
    const result = generateOwnedLMRules([])
    expect(result.villagesRule).toBeUndefined()
    expect(result.regionBandRules).toEqual([])
  })

  it('villages only creates villages rule with default strategy', () => {
    const regions: RegionRecord[] = [
      region('oak_village', 'village'),
      region('birch_village', 'village'),
    ]
    const result = generateOwnedLMRules(regions)
    expect(result.villagesRule).toBeDefined()
    expect(result.villagesRule!['custom-rule']).toContain('Villages')
    expect(result.villagesRule!['use-preset']).toBe('lvlstrategy-easy')
    expect(result.villagesRule!.conditions['worldguard-regions']).toEqual(['birch_village', 'oak_village'])
    expect(result.regionBandRules).toEqual([])
  })

  it('villages rule uses villageBandStrategy from meta', () => {
    const regions: RegionRecord[] = [region('oak_village', 'village')]
    const result = generateOwnedLMRules(regions, { villageBandStrategy: 'hard' })
    expect(result.villagesRule!['use-preset']).toBe('lvlstrategy-hard')
    expect(result.villagesRule!['custom-rule']).toContain('Hard')
  })

  it('region and heart create region-band rules with overworld world name', () => {
    const regions: RegionRecord[] = [
      region('desert_ruins', 'region'),
      region('heart_of_monkvos', 'heart'),
    ]
    const result = generateOwnedLMRules(regions)
    expect(result.villagesRule).toBeUndefined()
    expect(result.regionBandRules).toHaveLength(2)
    const desert = result.regionBandRules.find((r) => r.conditions['worldguard-regions'] === 'desert_ruins')
    const heart = result.regionBandRules.find((r) => r.conditions['worldguard-regions'] === 'heart_of_monkvos')
    expect(desert?.conditions.worlds).toBe('world')
    expect(desert?.['use-preset']).toBe('lvlstrategy-normal')
    expect(heart).toBeDefined()
  })

  it('nether region has world_nether', () => {
    const regions: RegionRecord[] = [region('nether_fortress', 'region', 'nether')]
    const result = generateOwnedLMRules(regions)
    expect(result.regionBandRules).toHaveLength(1)
    expect(result.regionBandRules[0].conditions.worlds).toBe('world_nether')
  })

  it('regionBands sets difficulty per region', () => {
    const regions: RegionRecord[] = [
      region('desert_ruins', 'region'),
      region('ice_cave', 'region'),
    ]
    const result = generateOwnedLMRules(regions, {
      regionBands: { desert_ruins: 'severe', ice_cave: 'easy' },
    })
    const desert = result.regionBandRules.find((r) => r.conditions['worldguard-regions'] === 'desert_ruins')
    const ice = result.regionBandRules.find((r) => r.conditions['worldguard-regions'] === 'ice_cave')
    expect(desert?.['use-preset']).toBe('lvlstrategy-severe')
    expect(ice?.['use-preset']).toBe('lvlstrategy-easy')
  })

  it('regionBandRules are sorted by custom-rule name', () => {
    const regions: RegionRecord[] = [
      region('z_final', 'region'),
      region('a_first', 'region'),
    ]
    const result = generateOwnedLMRules(regions)
    expect(result.regionBandRules[0]['custom-rule']).toMatch(/A First/)
    expect(result.regionBandRules[1]['custom-rule']).toMatch(/Z Final/)
  })
})
