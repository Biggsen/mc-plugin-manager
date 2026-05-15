import { describe, it, expect } from 'vitest'
import { buildCratePrizeItemLine, buildCratePrizesYamlMap, DEFAULT_CRATE_PRIZE_WEIGHT } from './cratePrizeGenerator'
import type { CratePrizeEntry, ItemIndexEntry } from './types'

describe('buildCratePrizesYamlMap', () => {
  it('maps catalog rows to CrazyCrates prize shape', () => {
    const itemsById = new Map<string, ItemIndexEntry>([
      ['TORCH', { id: 'TORCH', rawKey: 'torch', name: 'Torch', unitBuy: 2 }],
    ])
    const entries: CratePrizeEntry[] = [
      { entryId: 'a', itemId: 'TORCH', override: { weight: 40, amount: '8' } },
    ]
    const prizes = buildCratePrizesYamlMap(entries, itemsById) as Record<string, Record<string, unknown>>
    expect(prizes['1'].DisplayItem).toBe('torch')
    expect(prizes['1'].Weight).toBe(40)
    expect(prizes['1'].DisplayAmount).toBe(8)
    expect(prizes['1'].Items).toEqual(['item:torch, amount:8'])
  })

  it('appends enchantments to item line and display name', () => {
    const itemsById = new Map<string, ItemIndexEntry>([
      ['DIAMOND_SWORD', { id: 'DIAMOND_SWORD', rawKey: 'diamond_sword', name: 'diamond sword' }],
    ])
    const prizes = buildCratePrizesYamlMap(
      [
        {
          entryId: 'a',
          itemId: 'DIAMOND_SWORD',
          override: { enchantments: { sharpness: 5, unbreaking: 3 } },
        },
      ],
      itemsById
    ) as Record<string, Record<string, unknown>>
    expect(prizes['1'].Items).toEqual(['item:diamond_sword, amount:1, sharpness:5, unbreaking:3'])
    expect(String(prizes['1'].DisplayName)).toContain('enchanted')
  })

  it('buildCratePrizeItemLine sorts enchant keys', () => {
    expect(buildCratePrizeItemLine('bow', '1', { power: 3, unbreaking: 2 })).toBe(
      'item:bow, amount:1, power:3, unbreaking:2'
    )
  })

  it('uses default weight when override omitted', () => {
    const itemsById = new Map<string, ItemIndexEntry>()
    const prizes = buildCratePrizesYamlMap([{ entryId: 'a', itemId: 'IRON_INGOT' }], itemsById) as Record<
      string,
      Record<string, unknown>
    >
    expect(prizes['1'].Weight).toBe(DEFAULT_CRATE_PRIZE_WEIGHT)
  })
})
