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
  it('generateAACommands includes structure POIs with singular-type DisplayName and XP reward', () => {
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
      Reward: {
        Experience: 500,
        Command: {
          Execute: ['acb PLAYER +50'],
          Display: '50 claimblocks',
        },
      },
    })
  })

  it('maps trail_ruins to 200 XP on structure discovery command', () => {
    const regions: RegionRecord[] = [
      {
        world: 'overworld',
        id: 'rootbound_fragment',
        kind: 'structure',
        structureType: 'trail_ruins',
        discover: { method: 'on_enter', recipeId: 'none' },
      },
    ]
    const cmds = generateAACommands(regions)
    expect(cmds.discoverRootboundFragment).toEqual({
      Goal: 'Discover Rootbound Fragment',
      Message: 'You found Rootbound Fragment',
      Name: 'discover_rootbound_fragment',
      DisplayName: 'Trail Ruins Found',
      Type: 'normal',
      Reward: {
        Experience: 200,
        Command: {
          Execute: ['acb PLAYER +25'],
          Display: '25 claimblocks',
        },
      },
    })
  })

  it('generateAACustom emits single tier N(T) per structure family with calculated XP', () => {
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
        Reward: {
          Experience: 1237,
          Command: {
            Execute: ['acb PLAYER +99'],
            Display: '99 claimblocks',
          },
        },
      },
    })
  })

  it('calculates set XP for trail_ruins using base 250 and sqrt scaling', () => {
    const regions: RegionRecord[] = Array.from({ length: 9 }, (_, i) => ({
      world: 'overworld' as const,
      id: `trail_${i + 1}`,
      kind: 'structure' as const,
      structureType: 'trail_ruins',
      discover: { method: 'on_enter' as const, recipeId: 'none' as const },
    }))
    const families = {
      trail_ruins: { label: 'Trail Ruins', counter: 'trail_ruins_found' },
    }
    const custom = generateAACustom(regions, { Custom: {} }, families)
    expect(custom.trail_ruins_found).toEqual({
      9: {
        Message: 'All Trail Ruins Found!',
        Name: 'trail_ruins_found_9',
        DisplayName: 'Trail Ruins Wanderer',
        Type: 'normal',
        Reward: {
          Experience: 1500,
          Command: {
            Execute: ['acb PLAYER +120'],
            Display: '120 claimblocks',
          },
        },
      },
    })
  })
})
