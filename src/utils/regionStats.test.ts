import { describe, it, expect } from 'vitest'
import { computeRegionDisplayStats } from './regionStats'
import type { RegionRecord } from '../types'

function region(kind: RegionRecord['kind'], world: RegionRecord['world']): RegionRecord {
  const recipeId =
    kind === 'village' ? 'region' : kind === 'heart' ? (world === 'nether' ? 'nether_heart' : 'heart') : kind === 'region' ? (world === 'nether' ? 'nether_region' : 'region') : 'none'
  return {
    world,
    id: 'test',
    kind,
    discover: { method: 'on_enter', recipeId: recipeId as RegionRecord['discover']['recipeId'] },
  }
}

describe('computeRegionDisplayStats', () => {
  it('empty regions returns all zeros', () => {
    expect(computeRegionDisplayStats([])).toEqual({
      overworldRegions: 0,
      overworldVillages: 0,
      overworldHearts: 0,
      netherRegions: 0,
      netherHearts: 0,
      totalRegions: 0,
    })
  })

  it('counts overworld/nether by kind; totalRegions excludes system', () => {
    const regions: RegionRecord[] = [
      region('region', 'overworld'),
      region('village', 'overworld'),
      region('heart', 'overworld'),
      region('region', 'nether'),
      region('heart', 'nether'),
      region('system', 'overworld'),
    ]
    const stats = computeRegionDisplayStats(regions)
    expect(stats.overworldRegions).toBe(1)
    expect(stats.overworldVillages).toBe(1)
    expect(stats.overworldHearts).toBe(1)
    expect(stats.netherRegions).toBe(1)
    expect(stats.netherHearts).toBe(1)
    expect(stats.totalRegions).toBe(5)
  })
})
