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
      overworldStructures: 0,
      structureTypesOverworld: [],
      netherRegions: 0,
      netherHearts: 0,
      netherStructures: 0,
      structureTypesNether: [],
      totalRegions: 0,
      totalStructures: 0,
      structureTypesAll: [],
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
    expect(stats.overworldStructures).toBe(0)
    expect(stats.netherStructures).toBe(0)
    expect(stats.totalStructures).toBe(0)
    expect(stats.structureTypesOverworld).toEqual([])
    expect(stats.structureTypesNether).toEqual([])
    expect(stats.structureTypesAll).toEqual([])
  })

  it('counts structures by world and in total', () => {
    const st = (world: RegionRecord['world']): RegionRecord => ({
      world,
      id: 'poi_x',
      kind: 'structure',
      structureType: 'ancient_city',
      discover: { method: 'on_enter', recipeId: 'none' },
    })
    const regions: RegionRecord[] = [
      st('overworld'),
      st('overworld'),
      st('nether'),
    ]
    const stats = computeRegionDisplayStats(regions)
    expect(stats.overworldStructures).toBe(2)
    expect(stats.netherStructures).toBe(1)
    expect(stats.totalStructures).toBe(3)
    expect(stats.totalRegions).toBe(3)
    expect(stats.structureTypesOverworld).toEqual([{ structureType: 'ancient_city', count: 2 }])
    expect(stats.structureTypesNether).toEqual([{ structureType: 'ancient_city', count: 1 }])
    expect(stats.structureTypesAll).toEqual([{ structureType: 'ancient_city', count: 3 }])
  })

  it('breaks down multiple structure types; sorts by structureType', () => {
    const mk = (id: string, world: RegionRecord['world'], structureType: string): RegionRecord => ({
      world,
      id,
      kind: 'structure',
      structureType,
      discover: { method: 'on_enter', recipeId: 'none' },
    })
    const regions: RegionRecord[] = [
      mk('a', 'overworld', 'trail_ruins'),
      mk('b', 'overworld', 'ancient_city'),
      mk('c', 'overworld', 'ancient_city'),
    ]
    const stats = computeRegionDisplayStats(regions)
    expect(stats.structureTypesOverworld).toEqual([
      { structureType: 'ancient_city', count: 2 },
      { structureType: 'trail_ruins', count: 1 },
    ])
    expect(stats.structureTypesAll).toEqual(stats.structureTypesOverworld)
  })
})
