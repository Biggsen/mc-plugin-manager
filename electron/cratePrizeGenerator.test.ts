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
    expect(prizes['1'].DisplayName).toBe('<white>enchanted diamond sword')
  })

  it('buildCratePrizeItemLine sorts enchant keys', () => {
    expect(buildCratePrizeItemLine('bow', '1', { power: 3, unbreaking: 2 })).toBe(
      'item:bow, amount:1, power:3, unbreaking:2'
    )
  })

  it('emits virtual key prize with Commands and empty Items', () => {
    const itemsById = new Map<string, ItemIndexEntry>()
    const prizes = buildCratePrizesYamlMap(
      [
        {
          entryId: 'k',
          prizeKind: 'virtual_key',
          keyId: 'heart',
          itemId: 'CRATE_KEY_HEART',
          override: { weight: 10, amount: '2' },
        },
      ],
      itemsById
    ) as Record<string, Record<string, unknown>>
    expect(prizes['1'].DisplayItem).toBe('tripwire_hook')
    expect(prizes['1'].DisplayName).toBe('<white>Heart Crate Key')
    expect(prizes['1'].Items).toEqual([])
    expect(prizes['1'].Commands).toEqual(['cc give virtual HeartCrate 2 %player%'])
    expect(prizes['1'].Weight).toBe(10)
  })

  it('maps catalog enchanted book ids to enchanted_book + enchant line', () => {
    const itemsById = new Map<string, ItemIndexEntry>([
      [
        'ENCHANTED_BOOK_FEATHER_FALLING_4',
        {
          id: 'ENCHANTED_BOOK_FEATHER_FALLING_4',
          rawKey: 'enchanted_book_feather_falling_4',
          name: 'enchanted book (feather falling iv)',
        },
      ],
    ])
    const prizes = buildCratePrizesYamlMap(
      [{ entryId: 'a', itemId: 'ENCHANTED_BOOK_FEATHER_FALLING_4', override: { weight: 35 } }],
      itemsById
    ) as Record<string, Record<string, unknown>>
    expect(prizes['1'].DisplayItem).toBe('enchanted_book')
    expect(prizes['1'].Items).toEqual(['item:enchanted_book, amount:1, feather_falling:4'])
    expect(prizes['1'].DisplayName).toBe('<white>enchanted book (feather falling iv)')
  })

  it('includes quantity prefix only when display amount is greater than 1', () => {
    const itemsById = new Map<string, ItemIndexEntry>([
      ['TORCH', { id: 'TORCH', rawKey: 'torch', name: 'torch' }],
    ])
    const prizes = buildCratePrizesYamlMap(
      [
        { entryId: 'a', itemId: 'TORCH', override: { amount: '64' } },
        { entryId: 'b', itemId: 'TORCH' },
      ],
      itemsById
    ) as Record<string, Record<string, unknown>>
    expect(prizes['1'].DisplayName).toBe('<white>64x torch')
    expect(prizes['2'].DisplayName).toBe('<white>torch')
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
