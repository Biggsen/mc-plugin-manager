import { describe, it, expect } from 'vitest'
import {
  calculateTiers,
  VILLAGES_TEMPLATE,
  REGIONS_TEMPLATE,
  HEARTS_TEMPLATE,
  structureTypeToSingularTitle,
  generateAACommands,
  generateAACustom,
  generateTotalDiscoveredCustom,
  rewardDisplayFromCeExecuteLine,
  structuresFoundTierSpecs,
  structuresFoundTenDisplayNames,
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
    expect(structureTypeToSingularTitle('trail_ruins')).toBe('Trail Ruin')
    expect(structureTypeToSingularTitle('pillager_outpost')).toBe('Pillager Outpost')
  })
})

describe('rewardDisplayFromCeExecuteLine', () => {
  it('maps get_book_* to enchant labels with Roman levels', () => {
    expect(rewardDisplayFromCeExecuteLine('ce call get_book_respiration_3 player:PLAYER')).toBe('Respiration III')
    expect(rewardDisplayFromCeExecuteLine('ce call get_book_blast_protection_4 player:PLAYER')).toBe('Blast Protection IV')
    expect(rewardDisplayFromCeExecuteLine('ce call get_book_protection_5 player:PLAYER')).toBe('Protection V')
  })

  it('maps get_book_* without a numeric level', () => {
    expect(rewardDisplayFromCeExecuteLine('ce call get_book_mending player:PLAYER')).toBe('Mending')
  })

  it('maps get_potion_*', () => {
    expect(rewardDisplayFromCeExecuteLine('ce call get_potion_fire_resistance_long player:PLAYER')).toBe(
      'Potion of Fire Resistance'
    )
    expect(rewardDisplayFromCeExecuteLine('ce call get_potion_fire_resistance player:PLAYER')).toBe(
      'Potion of Fire Resistance'
    )
    expect(rewardDisplayFromCeExecuteLine('ce call get_potion_fire_resistance_2 player:PLAYER')).toBe(
      '2 Potions of Fire Resistance'
    )
  })

  it('returns null for non-ce lines', () => {
    expect(rewardDisplayFromCeExecuteLine('acb PLAYER +10')).toBeNull()
  })
})

describe('generateAACustom CE Display', () => {
  it('fills Reward.Command.Display from Execute when missing', () => {
    const regions: RegionRecord[] = Array.from({ length: 20 }, (_, i) => ({
      world: 'overworld' as const,
      id: `v${i}`,
      kind: 'village' as const,
      discover: { method: 'on_enter' as const, recipeId: 'none' as const },
    }))
    const template = {
      Custom: {
        villages_discovered: {
          10: {
            Message: 'You discovered 10 villages!',
            Name: 'villages_discovered_10',
            DisplayName: 'Test',
            Type: 'normal',
            Reward: {
              Command: {
                Execute: ['ce call get_book_mending player:PLAYER', 'ce call get_book_efficiency_5 player:PLAYER'],
              },
            },
          },
        },
      },
    }
    const custom = generateAACustom(regions, template)
    const tier = custom.villages_discovered?.[10]
    expect(tier?.Reward?.Command?.Display).toBe('Mending and Efficiency V')
  })

  it('appends alert Execute line for Legend display names', () => {
    const regions: RegionRecord[] = Array.from({ length: 20 }, (_, i) => ({
      world: 'overworld' as const,
      id: `r${i}`,
      kind: 'region' as const,
      discover: { method: 'on_enter' as const, recipeId: 'none' as const },
    }))
    const template = {
      Custom: {
        regions_discovered: {
          2: {
            Message: 'You discovered 2 regions!',
            Name: 'regions_discovered_2',
            DisplayName: 'Region Scout',
            Type: 'normal',
          },
          _all: {
            Message: 'You discovered all the regions!',
            Name: 'regions_discovered_999',
            DisplayName: 'Region Legend',
            Type: 'normal',
          },
        },
      },
    }
    const custom = generateAACustom(regions, template)
    const tier = custom.regions_discovered?.[20]
    expect(tier?.Reward?.Command?.Execute).toContain(
      'say §6PLAYER§7 has become a §6REGION LEGEND§7!'
    )
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
      DisplayName: 'Trail Ruin Found',
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
        DisplayName: 'Ancient City Legend',
        Type: 'normal',
        Reward: {
          Experience: 1237,
          Command: {
            Execute: [
              'acb PLAYER +99',
              'say §6PLAYER§7 has become an §6ANCIENT CITY LEGEND§7!',
            ],
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
        DisplayName: 'Trail Ruin Legend',
        Type: 'normal',
        Reward: {
          Experience: 1500,
          Command: {
            Execute: [
              'acb PLAYER +120',
              'say §6PLAYER§7 has become a §6TRAIL RUIN LEGEND§7!',
            ],
            Display: '120 claimblocks',
          },
        },
      },
    })
  })
})

describe('structuresFoundTierSpecs', () => {
  it('total 140: half at 70 beats every-10; quarter at 35; three quarters at 105 beats ten', () => {
    const specs = structuresFoundTierSpecs(140)
    const byVal = Object.fromEntries(specs.map((s) => [s.value, s.source]))
    expect(byVal[35]).toBe('quarter')
    expect(byVal[70]).toBe('half')
    expect(byVal[105]).toBe('threeQuarter')
    expect(byVal[140]).toBe('all')
    expect(byVal[10]).toBe('ten')
    expect(byVal[130]).toBe('ten')
    expect(specs.length).toBe(16)
  })

  it('total 20: half at 10 replaces every-10 at 10; three quarters at 15', () => {
    const specs = structuresFoundTierSpecs(20)
    expect(specs.map((s) => [s.value, s.source])).toEqual([
      [5, 'quarter'],
      [10, 'half'],
      [15, 'threeQuarter'],
      [20, 'all'],
    ])
  })
})

describe('generateTotalDiscoveredCustom', () => {
  it('maps percent tiers to ceil goals and LuckPerms explorer ranks', () => {
    const d = generateTotalDiscoveredCustom(130, 'Charidh')
    expect(d?.[13]?.Message).toBe('10% of Charidh explored!')
    expect(d?.[13]?.DisplayName).toBe('Wanderer')
    expect(d?.[13]?.Name).toBe('total_discovered_10')
    expect(d?.[13]?.Reward.Command.Execute[0]).toBe('lp user PLAYER parent set explorer_10')
    expect(d?.[13]?.Reward.Command.Execute[1]).toBe(
      'say §6PLAYER§7 has become a §6WANDERER§7!'
    )
    expect(d?.[26]?.DisplayName).toBe('Scout')
    expect(d?.[26]?.Reward.Command.Execute[1]).toBe(
      'say §6PLAYER§7 has become a §6SCOUT§7!'
    )
    expect(d?.[91]?.DisplayName).toBe('Outrider')
    expect(d?.[91]?.Reward.Command.Execute[1]).toBe(
      'say §6PLAYER§7 has become an §6OUTRIDER§7!'
    )
    expect(d?.[130]?.Message).toBe('100% of Charidh explored!')
    expect(d?.[130]?.DisplayName).toBe('Legend')
  })

  it('is emitted from generateAACustom when exploration total > 0', () => {
    const regions: RegionRecord[] = Array.from({ length: 130 }, (_, i) => ({
      world: 'overworld' as const,
      id: `r_${i}`,
      kind: 'region' as const,
      discover: { method: 'on_enter' as const, recipeId: 'none' as const },
    }))
    const custom = generateAACustom(
      regions,
      { Custom: { total_discovered: {} } },
      undefined,
      'TestWorld'
    )
    expect(custom.total_discovered?.[13]?.Message).toBe('10% of TestWorld explored!')
  })
})

describe('structuresFoundTenDisplayNames', () => {
  it('total 400: first segment uses Wanderer V then Scout IV; second starts Pathfinder I', () => {
    const d = structuresFoundTenDisplayNames(400)
    expect(d[10]).toBe('Structure Wanderer I')
    expect(d[50]).toBe('Structure Wanderer V')
    expect(d[60]).toBe('Structure Scout I')
    expect(d[90]).toBe('Structure Scout IV')
    expect(d[110]).toBe('Structure Pathfinder I')
    expect(d[190]).toBe('Structure Wayfarer IV')
    expect(d[210]).toBe('Structure Pioneer I')
    expect(d[290]).toBe('Structure Outrider IV')
    expect(d[310]).toBe('Structure Chronicler I')
    expect(d[390]).toBe('Structure Cartographer IV')
  })
})

describe('generateAACustom structures_found', () => {
  const sfTemplate = {
    10: {
      Message: 'You found 10 structures!',
      DisplayName: 'Structure Wanderer',
      Type: 'normal',
    },
    _quarter: { Message: 'Quarter', DisplayName: 'Structure Seeker', Type: 'rare' },
    _half: { Message: 'Half', DisplayName: 'Structure Trailblazer', Type: 'rare' },
    _threeQuarter: { Message: 'Three quarters', DisplayName: 'Structure Vanguard', Type: 'rare' },
    _all: { Message: 'All', DisplayName: 'Structure Legend', Type: 'rare' },
  }

  it('emits claim tiers and legend alert on Structure Legend', () => {
    const regions: RegionRecord[] = Array.from({ length: 4 }, (_, i) => ({
      world: 'overworld' as const,
      id: `st_${i}`,
      kind: 'structure' as const,
      structureType: 'ancient_city',
      discover: { method: 'on_enter' as const, recipeId: 'none' as const },
    }))
    const custom = generateAACustom(
      regions,
      { Custom: { structures_found: sfTemplate } },
      { ancient_city: { label: 'Ancient Cities', counter: 'ancient_cities_found' } }
    )
    expect(custom.structures_found?.[1].Reward.Command.Execute[0]).toBe('acb PLAYER +200')
    expect(custom.structures_found?.[2].Reward.Command.Execute[0]).toBe('acb PLAYER +200')
    expect(custom.structures_found?.[3].DisplayName).toBe('Structure Vanguard')
    expect(custom.structures_found?.[3].Reward.Command.Execute[0]).toBe('acb PLAYER +200')
    expect(custom.structures_found?.[4].Reward.Command.Execute[0]).toBe('acb PLAYER +500')
    const allExecute = custom.structures_found?.[4].Reward.Command.Execute as string[]
    expect(allExecute.some((l) => l.includes('LEGEND'))).toBe(true)
  })
})

