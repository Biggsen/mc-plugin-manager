import { describe, it, expect } from 'vitest'
import { computeRegionCounts, computeRegionStats } from './regionStats'
import type { RegionRecord } from '../types'

function region(
  kind: 'system' | 'region' | 'village' | 'heart',
  world: 'overworld' | 'nether' = 'overworld',
  method: 'disabled' | 'on_enter' | 'first_join' = 'on_enter'
): RegionRecord {
  const recipeId =
    kind === 'village' ? 'region' : kind === 'heart' ? (world === 'nether' ? 'nether_heart' : 'heart') : kind === 'region' ? (world === 'nether' ? 'nether_region' : 'region') : 'none'
  return {
    world,
    id: 'test',
    kind,
    discover: { method, recipeId: recipeId as RegionRecord['discover']['recipeId'] },
  }
}

describe('computeRegionCounts', () => {
  it('empty regions returns all zeros', () => {
    expect(computeRegionCounts([])).toEqual({
      overworldRegions: 0,
      overworldHearts: 0,
      netherRegions: 0,
      netherHearts: 0,
      villages: 0,
      total: 0,
    })
  })

  it('excludes disabled regions from total', () => {
    const regions = [region('system', 'overworld', 'disabled'), region('village')]
    const counts = computeRegionCounts(regions)
    expect(counts.total).toBe(1)
    expect(counts.villages).toBe(1)
  })

  it('counts overworld/nether regions and hearts and villages', () => {
    const regions: RegionRecord[] = [
      region('region'),
      region('region'),
      region('heart'),
      region('village'),
      region('region', 'nether'),
      region('heart', 'nether'),
    ]
    const counts = computeRegionCounts(regions)
    expect(counts.overworldRegions).toBe(2)
    expect(counts.overworldHearts).toBe(1)
    expect(counts.villages).toBe(1)
    expect(counts.netherRegions).toBe(1)
    expect(counts.netherHearts).toBe(1)
    expect(counts.total).toBe(6)
  })
})

describe('computeRegionStats', () => {
  it('empty regions returns all zeros', () => {
    expect(computeRegionStats([])).toEqual({
      overworld: 0,
      nether: 0,
      hearts: 0,
      villages: 0,
      regions: 0,
      system: 0,
    })
  })

  it('counts by world and kind including disabled', () => {
    const regions: RegionRecord[] = [
      region('region'),
      region('region', 'nether'),
      region('village'),
      region('heart'),
      region('system', 'overworld', 'disabled'),
    ]
    const stats = computeRegionStats(regions)
    expect(stats.overworld).toBe(4)
    expect(stats.nether).toBe(1)
    expect(stats.regions).toBe(2)
    expect(stats.villages).toBe(1)
    expect(stats.hearts).toBe(1)
    expect(stats.system).toBe(1)
  })
})
