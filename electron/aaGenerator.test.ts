import { describe, it, expect } from 'vitest'
import {
  calculateTiers,
  VILLAGES_TEMPLATE,
  REGIONS_TEMPLATE,
  HEARTS_TEMPLATE,
  structureTypeToSingularTitle,
  generateAACommands,
  generateAACustom,
} from './aaGenerator'

import type { RegionRecord } from './types'

describe('calculateTiers', () => {
  it('67 villages', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 67)).toEqual([
      1, 10, 20, 33, 40, 50, 60, 67,
    ])
  })

  it('63 villages (too-close rule drops 60)', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 63)).toEqual([
      1, 10, 20, 31, 40, 50, 63,
    ])
  })

  it('33 regions', () => {
    expect(calculateTiers(REGIONS_TEMPLATE, 33)).toEqual([2, 16, 33])
  })

  it('5 villages (edge case)', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 5)).toEqual([2, 5])
  })

  it('zero total returns empty array', () => {
    expect(calculateTiers(VILLAGES_TEMPLATE, 0)).toEqual([])
  })

  it('total 1 (hearts)', () => {
    expect(calculateTiers(HEARTS_TEMPLATE, 1)).toEqual([1])
  })

  it('half equals all (total 2)', () => {
    expect(calculateTiers(HEARTS_TEMPLATE, 2)).toEqual([1, 2])
  })
})

describe('structureTypeToSingularTitle', () => {
  it('title-cases segments', () => {
    expect(structureTypeToSingularTitle('ancient_city')).toBe('Ancient City')
    expect(structureTypeToSingularTitle('buried_treasure')).toBe('Buried Treasure')
    expect(structureTypeToSingularTitle('pillager_outpost')).toBe('Pillager Outpost')
  })
})

describe('structure AA generation', () => {
  it('generateAACommands includes structure POIs with singular-type DisplayName', () => {
    const regions: RegionRecord[] = [
      {
        world: 'overworld',
        id: 'inner_core',
        kind: 'structure',
        structureType: 'ancient_city',
        discover: { method: 'on_enter', recipeId: 'none' },
      },
    ]
    const cmds = generateAACommands(regions)
    expect(cmds.discoverInnerCore).toEqual({
      Goal: 'Discover Inner Core',
      Message: 'You found Inner Core',
      Name: 'discover_inner_core',
      DisplayName: 'Ancient City Found',
      Type: 'normal',
    })
  })

  it('generateAACustom emits single tier N(T) per structure family', () => {
    const regions: RegionRecord[] = [
      {
        world: 'overworld',
        id: 'a',
        kind: 'structure',
        structureType: 'ancient_city',
        discover: { method: 'on_enter', recipeId: 'none' },
      },
      {
        world: 'overworld',
        id: 'b',
        kind: 'structure',
        structureType: 'ancient_city',
        discover: { method: 'on_enter', recipeId: 'none' },
      },
    ]
    const families = {
      ancient_city: { label: 'Ancient Cities', counter: 'ancient_cities_found' },
    }
    const custom = generateAACustom(regions, { Custom: {} }, families)
    expect(custom.ancient_cities_found).toEqual({
      2: {
        Message: 'All Ancient Cities Found!',
        Name: 'ancient_cities_found_2',
        DisplayName: 'Ancient Cities Wanderer',
        Type: 'normal',
        Reward: { Experience: 1000 },
      },
    })
  })
})
